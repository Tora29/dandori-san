import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createTripCrypto, type TripCrypto } from './crypto/trip-crypto.js';
import { generateTripKey } from './crypto/trip-key.js';
import type { MemberRecord, NewTripRecord, TripRecord } from './trip-records.js';
import type { NewTrip } from './trip-rules.js';
import { openMember, openTrip, sealNewMember, sealNewTrip } from './trip-seal.js';

const today = '2026-10-01';

const trip: NewTrip = {
	title: '山の温泉めぐり',
	startDate: '2026-11-03',
	endDate: '2026-11-05',
	organizerName: 'はると'
};

async function newTripCrypto(): Promise<TripCrypto> {
	return createTripCrypto(generateTripKey());
}

// サーバーが返す形にする（幹事を書き戻し、版は 1）
function stored(record: NewTripRecord): TripRecord {
	return {
		id: record.id,
		titleSealed: record.titleSealed,
		startDateSealed: record.startDateSealed,
		endDateSealed: record.endDateSealed,
		organizerId: record.organizer.id,
		deleteOn: record.deleteOn,
		plansRevision: 1,
		version: 1
	};
}

describe('しおりを暗号にして読む', () => {
	it('暗号にしたしおりを、同じ鍵で読める', async () => {
		const tripCrypto = await newTripCrypto();
		const opened = await openTrip(tripCrypto, stored(await sealNewTrip(tripCrypto, trip, today)));

		expect(opened).toMatchObject({
			title: '山の温泉めぐり',
			startDate: '2026-11-03',
			endDate: '2026-11-05',
			deleteOn: '2027-02-28'
		});
	});

	it('送る形に、中身をそのまま入れない', async () => {
		const sent = JSON.stringify(await sealNewTrip(await newTripCrypto(), trip, today));
		for (const plaintext of ['山の温泉めぐり', '2026-11-03', '2026-11-05', 'はると']) {
			expect(sent).not.toContain(plaintext);
		}
	});

	it('しおりと幹事の ID を、別々に作る', async () => {
		const record = await sealNewTrip(await newTripCrypto(), trip, today);
		expect(record.id).not.toBe(record.organizer.id);
	});

	it('幹事には、足した人を付けない', async () => {
		const record = await sealNewTrip(await newTripCrypto(), trip, today);
		expect(record.organizer.addedBy).toBeNull();
	});

	it('決まりに合わない入力は暗号にしない', async () => {
		await expect(
			sealNewTrip(await newTripCrypto(), { ...trip, organizerName: 'はる\nと' }, today)
		).rejects.toThrow(ZodError);
	});
});

describe('読めない所だけを読めないものにする', () => {
	it('決まりに合わない旅の名前を書き込まれても、日にちは読める', async () => {
		const tripCrypto = await newTripCrypto();
		const record = stored(await sealNewTrip(tripCrypto, trip, today));
		const titleSealed = await tripCrypto.seal('trips.title', record.id, 1, '山の\n旅');

		const opened = await openTrip(tripCrypto, { ...record, titleSealed });
		expect(opened).toMatchObject({ title: null, startDate: '2026-11-03', endDate: '2026-11-05' });
	});

	it('はじめと終わりの組が決まりに合わなければ、日にちを両方とも読めないものにする', async () => {
		const tripCrypto = await newTripCrypto();
		const record = stored(await sealNewTrip(tripCrypto, trip, today));
		const [startDateSealed, endDateSealed] = await Promise.all([
			tripCrypto.seal('trips.start_date', record.id, 1, '2999-12-31'),
			tripCrypto.seal('trips.end_date', record.id, 1, '2000-01-01')
		]);

		const opened = await openTrip(tripCrypto, { ...record, startDateSealed, endDateSealed });
		expect(opened).toMatchObject({ title: '山の温泉めぐり', startDate: null, endDate: null });
	});

	it('ほかの鍵では、全部を読めないものにする（例外にしない）', async () => {
		const record = stored(await sealNewTrip(await newTripCrypto(), trip, today));
		const opened = await openTrip(await newTripCrypto(), record);
		expect(opened).toMatchObject({ title: null, startDate: null, endDate: null });
	});

	it('版が上がったあとに前の暗号文が残っていたら、読めないものにする', async () => {
		const tripCrypto = await newTripCrypto();
		const record = stored(await sealNewTrip(tripCrypto, trip, today));
		const opened = await openTrip(tripCrypto, { ...record, version: 2 });
		expect(opened.title).toBeNull();
	});
});

describe('一緒に行く人を暗号にして読む', () => {
	async function stored(tripCrypto: TripCrypto, name: string): Promise<MemberRecord> {
		const record = await sealNewMember(tripCrypto, { name, addedBy: null });
		return { ...record, tripId: 1, version: 1 };
	}

	it('呼び名をそろえてから暗号にし、同じ鍵で読める', async () => {
		const tripCrypto = await newTripCrypto();
		const member = await openMember(tripCrypto, await stored(tripCrypto, ' \u304B\u3099く '));
		expect(member).toMatchObject({ name: 'がく', nameIndexMismatch: false });
	});

	it('決まりに合わない呼び名は暗号にしない', async () => {
		await expect(
			sealNewMember(await newTripCrypto(), { name: 'そら\u200B', addedBy: null })
		).rejects.toThrow(ZodError);
	});

	it('決まりに合わない呼び名を書き込まれていたら、その人の名前だけを読めないものにする', async () => {
		const tripCrypto = await newTripCrypto();
		const record = await stored(tripCrypto, 'ゆい');
		const nameSealed = await tripCrypto.seal('members.name', record.id, 1, 'ゆ\nい');

		expect(await openMember(tripCrypto, { ...record, nameSealed })).toMatchObject({
			name: null,
			nameIndexMismatch: false
		});
	});

	it('HMAC と合わない呼び名には、印を付ける（止めない）', async () => {
		const tripCrypto = await newTripCrypto();
		const record = await stored(tripCrypto, 'ゆい');
		const other = await stored(tripCrypto, 'そら');

		expect(await openMember(tripCrypto, { ...record, nameIndex: other.nameIndex })).toMatchObject({
			name: 'ゆい',
			nameIndexMismatch: true
		});
	});
});
