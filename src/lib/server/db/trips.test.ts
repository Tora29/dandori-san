import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { NewTripRecord } from '#lib/trip-records.js';
import { openMember, openTrip, sealNewTrip } from '#lib/trip-seal.js';
import { uniqueViolation } from './constraint.js';
import { listMembers } from './members.js';
import { clearTables, count, makeTrip, newAccess, newTrip, today } from './test-support.js';
import { createTrip, findTrip } from './trips.js';

beforeEach(clearTables);

async function sealed(): Promise<{ accessHash: string; record: NewTripRecord }> {
	const { tripCrypto, accessHash } = await newAccess();
	return { accessHash, record: await sealNewTrip(tripCrypto, newTrip(), today) };
}

describe('しおりを作る', () => {
	it('しおりと幹事を作り、幹事をしおりに書く', async () => {
		const { tripCrypto, accessHash, trip } = await makeTrip();
		const [first, ...rest] = await listMembers(env.DB, accessHash, today);
		if (first === undefined) {
			throw new Error('幹事がいません');
		}

		expect(await openTrip(tripCrypto, trip)).toMatchObject({
			title: '山の温泉めぐり',
			startDate: '2026-11-03',
			endDate: '2026-11-05',
			deleteOn: '2027-02-28',
			plansRevision: 1,
			version: 1
		});
		expect(rest).toHaveLength(0);
		expect(await openMember(tripCrypto, first)).toMatchObject({ name: 'はると', addedBy: null });
		expect(trip.organizerId).toBe(first.id);
	});

	it('D1 には、旅の名前・日にち・呼び名・札をそのまま置かない', async () => {
		const { tripCrypto } = await makeTrip();
		const trips = await env.DB.prepare('SELECT * FROM trips').all();
		const members = await env.DB.prepare('SELECT * FROM members').all();
		const stored = JSON.stringify([trips.results, members.results]);
		for (const plaintext of [
			'山の温泉めぐり',
			'2026-11-03',
			'2026-11-05',
			'はると',
			tripCrypto.accessToken
		]) {
			expect(stored).not.toContain(plaintext);
		}
	});

	it('同じ札のしおりは2つ作らず、すでにあると返す', async () => {
		const { tripCrypto, accessHash } = await newAccess();
		await createTrip(env.DB, accessHash, await sealNewTrip(tripCrypto, newTrip(), today), today);
		const again = await createTrip(
			env.DB,
			accessHash,
			await sealNewTrip(tripCrypto, newTrip(), today),
			today
		);

		expect(again).toEqual({ kind: 'exists' });
		await expect(count('trips')).resolves.toBe(1);
	});

	it('消したしおりと同じ札では、作り直せない', async () => {
		const { accessHash, record } = await sealed();
		await env.DB.prepare('INSERT INTO deleted_trips (access_hash, deleted_on) VALUES (?, ?)')
			.bind(accessHash, '2026-09-30')
			.run();

		await expect(createTrip(env.DB, accessHash, record, today)).resolves.toEqual({
			kind: 'deleted'
		});
		await expect(count('trips')).resolves.toBe(0);
	});

	it('しおりの ID がほかのしおりとぶつかったら、作り直してもらう', async () => {
		const { trip } = await makeTrip();
		const { accessHash, record } = await sealed();

		await expect(
			createTrip(env.DB, accessHash, { ...record, id: trip.id }, today)
		).resolves.toEqual({
			kind: 'idTaken'
		});
		await expect(count('trips')).resolves.toBe(1);
	});

	it('幹事の ID がほかの人とぶつかったら、しおりも幹事も残さない', async () => {
		const { trip } = await makeTrip();
		const { accessHash, record } = await sealed();
		const organizerId = trip.organizerId ?? 0;

		await expect(
			createTrip(
				env.DB,
				accessHash,
				{ ...record, organizer: { ...record.organizer, id: organizerId } },
				today
			)
		).resolves.toEqual({ kind: 'idTaken' });
		await expect(count('trips')).resolves.toBe(1);
		await expect(count('members')).resolves.toBe(1);
	});

	it.each([
		['暗号文の長さが違う', (r: NewTripRecord) => ({ ...r, titleSealed: r.startDateSealed })],
		['暗号文でない', (r: NewTripRecord) => ({ ...r, titleSealed: '山の温泉めぐり' })],
		['消す日が遠い先', (r: NewTripRecord) => ({ ...r, deleteOn: '2999-12-31' })],
		['消す日が月の末日でない', (r: NewTripRecord) => ({ ...r, deleteOn: '2027-02-27' })],
		['消す日が過ぎている', (r: NewTripRecord) => ({ ...r, deleteOn: '2026-09-30' })],
		['ID が 0', (r: NewTripRecord) => ({ ...r, id: 0 })],
		['ID が小数', (r: NewTripRecord) => ({ ...r, id: 1.5 })],
		['ID が大きすぎる', (r: NewTripRecord) => ({ ...r, id: 2 ** 52 + 1 })],
		[
			'幹事に足した人がいる',
			(r: NewTripRecord) => ({ ...r, organizer: { ...r.organizer, addedBy: 1 } })
		],
		[
			'HMAC の形が違う',
			(r: NewTripRecord) => ({ ...r, organizer: { ...r.organizer, nameIndex: 'x' } })
		]
	])('%sものは、D1 に書く前に断る', async (_, change) => {
		const { accessHash, record } = await sealed();
		await expect(createTrip(env.DB, accessHash, change(record), today)).rejects.toThrow(ZodError);
	});
});

describe('しおりを探す', () => {
	it('札のハッシュで探せる', async () => {
		const { accessHash, trip } = await makeTrip();
		await expect(findTrip(env.DB, accessHash, today)).resolves.toEqual({ kind: 'found', trip });
	});

	it('ほかの札なら見つからない', async () => {
		await makeTrip();
		const { accessHash } = await newAccess();
		await expect(findTrip(env.DB, accessHash, today)).resolves.toEqual({ kind: 'missing' });
	});

	it('消す日になったら、消す前でも消したものとして扱う', async () => {
		const { accessHash } = await makeTrip();
		await expect(findTrip(env.DB, accessHash, '2027-02-27')).resolves.toMatchObject({
			kind: 'found'
		});
		await expect(findTrip(env.DB, accessHash, '2027-02-28')).resolves.toEqual({ kind: 'deleted' });
	});

	it('消したしおりの印があれば、消したものとして扱う', async () => {
		const { accessHash } = await newAccess();
		await env.DB.prepare('INSERT INTO deleted_trips (access_hash, deleted_on) VALUES (?, ?)')
			.bind(accessHash, '2026-09-30')
			.run();
		await expect(findTrip(env.DB, accessHash, today)).resolves.toEqual({ kind: 'deleted' });
	});
});

describe('D1 を書き換えられたとき', () => {
	it('ほかのしおりの旅の名前に差し替えられても、日にちは読める', async () => {
		const a = await makeTrip();
		const b = await makeTrip({ title: '別の旅' });
		await env.DB.prepare(
			'UPDATE trips SET title_sealed = (SELECT title_sealed FROM trips WHERE access_hash = ?) WHERE access_hash = ?'
		)
			.bind(b.accessHash, a.accessHash)
			.run();

		const found = await findTrip(env.DB, a.accessHash, today);
		if (found.kind !== 'found') {
			throw new Error('しおりが見つかりません');
		}
		expect(await openTrip(a.tripCrypto, found.trip)).toMatchObject({
			title: null,
			startDate: '2026-11-03'
		});
	});

	it('はじめと終わりの日を入れ替えられたら、日にちを読めないものにする', async () => {
		const { tripCrypto, accessHash } = await makeTrip();
		await env.DB.prepare(
			'UPDATE trips SET start_date_sealed = end_date_sealed, end_date_sealed = start_date_sealed WHERE access_hash = ?'
		)
			.bind(accessHash)
			.run();

		const found = await findTrip(env.DB, accessHash, today);
		if (found.kind !== 'found') {
			throw new Error('しおりが見つかりません');
		}
		expect(await openTrip(tripCrypto, found.trip)).toMatchObject({
			startDate: null,
			endDate: null
		});
	});
});

describe('テーブルの決まり', () => {
	async function rejected(statement: D1PreparedStatement): Promise<string> {
		const error: unknown = await statement.run().then(
			() => null,
			(thrown: unknown) => thrown
		);
		return String(error);
	}

	it('形の違う消す日は、D1 が受け付けない', async () => {
		const { accessHash } = await makeTrip();
		const statement = env.DB.prepare('UPDATE trips SET delete_on = ? WHERE access_hash = ?').bind(
			'abc',
			accessHash
		);
		expect(await rejected(statement)).toContain('CHECK constraint failed');
	});

	it('数の列に文字を入れられない（STRICT）', async () => {
		const { accessHash } = await makeTrip();
		const statement = env.DB.prepare(
			'UPDATE trips SET plans_revision = ? WHERE access_hash = ?'
		).bind('abc', accessHash);
		expect(await rejected(statement)).toContain('cannot store TEXT value in INTEGER column');
	});

	it('消したしおりの印に、空の札のハッシュを入れられない', async () => {
		const statement = env.DB.prepare(
			'INSERT INTO deleted_trips (access_hash, deleted_on) VALUES (NULL, ?)'
		).bind('2026-10-31');
		expect(await rejected(statement)).toContain('NOT NULL constraint failed');
	});

	it('ほかのしおりの人を、幹事にできない', async () => {
		const a = await makeTrip();
		const b = await makeTrip();
		const statement = env.DB.prepare('UPDATE trips SET organizer_id = ? WHERE id = ?').bind(
			b.trip.organizerId,
			a.trip.id
		);
		expect(await rejected(statement)).toContain('FOREIGN KEY constraint failed');
	});

	it('ほかのしおりの人を、足した人にできない', async () => {
		const a = await makeTrip();
		const b = await makeTrip();
		const statement = env.DB.prepare('UPDATE members SET added_by = ? WHERE trip_id = ?').bind(
			b.trip.organizerId,
			a.trip.id
		);
		expect(await rejected(statement)).toContain('FOREIGN KEY constraint failed');
	});
});

describe('UNIQUE の決まりの読み方', () => {
	it.each([
		[new Error('D1_ERROR: UNIQUE constraint failed: trips.id: SQLITE_CONSTRAINT'), 'trips.id'],
		[new Error('外側', { cause: new Error('UNIQUE constraint failed: members.id') }), 'members.id'],
		[new Error('CHECK constraint failed: x'), null],
		['UNIQUE constraint failed: trips.id', null]
	])('%s から %s を読む', (error, expected) => {
		expect(uniqueViolation(error)).toBe(expected);
	});
});
