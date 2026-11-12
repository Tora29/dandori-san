import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { membersMaxCount } from '#lib/trip-limits.js';
import { openMember, sealNewMember } from '#lib/trip-seal.js';
import { addMember, listMembers } from './members.js';
import { clearTables, count, makeTrip, newAccess, today, type TestTrip } from './test-support.js';

beforeEach(clearTables);

async function names({ tripCrypto, accessHash }: TestTrip, on = today): Promise<(string | null)[]> {
	const records = await listMembers(env.DB, accessHash, on);
	const members = await Promise.all(records.map((record) => openMember(tripCrypto, record)));
	return members.map((member) => member.name);
}

async function add(target: TestTrip, name: string, addedBy: number | null = null, on = today) {
	return addMember(
		env.DB,
		target.accessHash,
		await sealNewMember(target.tripCrypto, { name, addedBy }),
		on
	);
}

describe('一緒に行く人を足す', () => {
	it('自分で名前を入れた人を足す', async () => {
		const target = await makeTrip();

		await expect(add(target, 'ゆい')).resolves.toMatchObject({
			kind: 'added',
			member: { addedBy: null, tripId: target.trip.id }
		});
		await expect(names(target)).resolves.toEqual(['はると', 'ゆい']);
	});

	it('ほかの人が足した人には、足した人を残す', async () => {
		const target = await makeTrip();

		await expect(add(target, 'そら', target.trip.organizerId)).resolves.toMatchObject({
			kind: 'added',
			member: { addedBy: target.trip.organizerId }
		});
	});

	it('同じしおりに、同じ呼び名の人は足せない', async () => {
		const target = await makeTrip();

		await expect(add(target, 'はると')).resolves.toEqual({ kind: 'nameTaken' });
		await expect(names(target)).resolves.toEqual(['はると']);
	});

	it.each([
		['見た目が同じ（か と濁点）', '\u304B\u3099く', '\u304Cく'],
		['前後の空白', ' ゆい ', 'ゆい'],
		['全角と半角', 'ＹＵＩ', 'yui'],
		['大文字と小文字', 'Yui', 'yui'],
		['半角のカタカナ', 'ﾕｲ', 'ユイ'],
		['途中の空白', 'ゆ い', 'ゆい']
	])('%sだけが違う呼び名は、同じ呼び名として断る', async (_, first, second) => {
		const target = await makeTrip();
		await add(target, first);

		await expect(add(target, second)).resolves.toEqual({ kind: 'nameTaken' });
	});

	it('ほかのしおりにいる呼び名でも足せる', async () => {
		await makeTrip();
		const other = await makeTrip({ organizerName: 'ゆい' });

		await expect(add(other, 'はると')).resolves.toMatchObject({ kind: 'added' });
		await expect(names(other)).resolves.toEqual(['ゆい', 'はると']);
	});

	it('ほかのしおりの人を、足した人にできない', async () => {
		const target = await makeTrip();
		const other = await makeTrip();

		await expect(add(target, 'そら', other.trip.organizerId)).resolves.toEqual({
			kind: 'invalidAddedBy'
		});
		await expect(names(target)).resolves.toEqual(['はると']);
	});

	it('無いしおりの札では足せない', async () => {
		await makeTrip();
		const { tripCrypto, accessHash } = await newAccess();
		const record = await sealNewMember(tripCrypto, { name: 'そら', addedBy: null });

		await expect(addMember(env.DB, accessHash, record, today)).resolves.toEqual({
			kind: 'missing'
		});
		await expect(count('members')).resolves.toBe(1);
	});

	it('消す日を過ぎたしおりには足せず、並べもしない', async () => {
		const target = await makeTrip();

		await expect(add(target, 'そら', null, '2027-02-28')).resolves.toEqual({ kind: 'missing' });
		await expect(names(target, '2027-02-28')).resolves.toEqual([]);
		await expect(count('members')).resolves.toBe(1);
	});

	it('ID がほかの人とぶつかったら、作り直してもらう', async () => {
		const target = await makeTrip();
		const other = await makeTrip();
		const record = await sealNewMember(target.tripCrypto, { name: 'そら', addedBy: null });

		await expect(
			addMember(env.DB, target.accessHash, { ...record, id: other.trip.organizerId }, today)
		).resolves.toEqual({ kind: 'idTaken' });
	});

	it(`${String(membersMaxCount)}人より多くは足せない`, async () => {
		const target = await makeTrip();
		// 足す SQL は、数の確かめと書き込みを1つの文で行うので、同時に足しても上限を超えない
		await Promise.all(
			Array.from({ length: membersMaxCount - 1 }, (_, i) => add(target, `人${String(i + 1)}`))
		);
		await expect(names(target)).resolves.toHaveLength(membersMaxCount);

		await expect(add(target, 'もう1人')).resolves.toEqual({ kind: 'tooMany' });
		await expect(names(target)).resolves.toHaveLength(membersMaxCount);
	});

	it(`${String(membersMaxCount)}人で、しかも同じ呼び名なら、同じ呼び名を先に知らせる`, async () => {
		const target = await makeTrip();
		// 足す SQL は、数の確かめと書き込みを1つの文で行うので、同時に足しても上限を超えない
		await Promise.all(
			Array.from({ length: membersMaxCount - 1 }, (_, i) => add(target, `人${String(i + 1)}`))
		);

		await expect(add(target, 'はると')).resolves.toEqual({ kind: 'nameTaken' });
	});

	it('暗号文の形が違うものは、D1 に書く前に断る', async () => {
		const target = await makeTrip();
		const record = await sealNewMember(target.tripCrypto, { name: 'そら', addedBy: null });

		await expect(
			addMember(env.DB, target.accessHash, { ...record, nameSealed: 'そら' }, today)
		).rejects.toThrow(ZodError);
	});
});

describe('一緒に行く人を並べる', () => {
	it('名前を入れた順に並べる', async () => {
		const target = await makeTrip();
		await add(target, 'ゆい');
		await add(target, 'そら');

		await expect(names(target)).resolves.toEqual(['はると', 'ゆい', 'そら']);
	});

	it('ほかのしおりの人は出さない', async () => {
		const target = await makeTrip();
		const other = await makeTrip();
		await add(other, 'ゆい');

		await expect(names(target)).resolves.toEqual(['はると']);
	});

	it('呼び名の暗号文を入れ替えられたら、その人たちの名前だけを読めないものにする', async () => {
		const target = await makeTrip();
		await add(target, 'ゆい');
		const { results } = await env.DB.prepare(
			'SELECT id, name_sealed FROM members ORDER BY seq'
		).all<{
			id: number;
			name_sealed: string;
		}>();
		const [first, second] = results;
		if (first === undefined || second === undefined) {
			throw new Error('2人いません');
		}
		await env.DB.batch([
			env.DB.prepare('UPDATE members SET name_sealed = ? WHERE id = ?').bind(
				second.name_sealed,
				first.id
			),
			env.DB.prepare('UPDATE members SET name_sealed = ? WHERE id = ?').bind(
				first.name_sealed,
				second.id
			)
		]);

		await expect(names(target)).resolves.toEqual([null, null]);
	});
});
