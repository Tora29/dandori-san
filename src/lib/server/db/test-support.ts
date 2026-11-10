// cloudflare:test はテストの中にしか無いので、本番のコードからまちがえて読むと build で止まる
import 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { createTripCrypto, type TripCrypto } from '#lib/crypto/trip-crypto.js';
import { generateTripKey } from '#lib/crypto/trip-key.js';
import type { TripRecord } from '#lib/trip-records.js';
import type { NewTrip } from '#lib/trip-rules.js';
import { sealNewTrip } from '#lib/trip-seal.js';
import { hashAccessToken } from '../access.js';
import { createTrip } from './trips.js';

export const today = '2026-10-01';

export function newTrip(overrides: Partial<NewTrip> = {}): NewTrip {
	return {
		title: '山の温泉めぐり',
		startDate: '2026-11-03',
		endDate: '2026-11-05',
		organizerName: 'はると',
		...overrides
	};
}

// D1 はテストのファイルごとにしか分かれないので、テストごとに空にする。
// しおりに付く表は ON DELETE CASCADE で一緒に消える
export async function clearTables(): Promise<void> {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM trips'),
		env.DB.prepare('DELETE FROM deleted_trips')
	]);
}

export interface TestTrip {
	tripCrypto: TripCrypto;
	accessHash: string;
	trip: TripRecord;
}

export async function newAccess(): Promise<{ tripCrypto: TripCrypto; accessHash: string }> {
	const tripCrypto = await createTripCrypto(generateTripKey());
	return { tripCrypto, accessHash: await hashAccessToken(tripCrypto.accessToken) };
}

// 端末と同じ手順（入力を確かめて暗号にする → 札のハッシュで D1 に置く）でしおりを作る
export async function makeTrip(overrides: Partial<NewTrip> = {}): Promise<TestTrip> {
	const { tripCrypto, accessHash } = await newAccess();
	const result = await createTrip(
		env.DB,
		accessHash,
		await sealNewTrip(tripCrypto, newTrip(overrides), today),
		today
	);
	if (result.kind !== 'created') {
		throw new Error(`しおりを作れませんでした：${result.kind}`);
	}
	return { tripCrypto, accessHash, trip: result.trip };
}

export async function count(table: 'trips' | 'members' | 'deleted_trips'): Promise<number> {
	const statements = {
		trips: env.DB.prepare('SELECT count(*) AS n FROM trips'),
		members: env.DB.prepare('SELECT count(*) AS n FROM members'),
		deleted_trips: env.DB.prepare('SELECT count(*) AS n FROM deleted_trips')
	};
	const row = await statements[table].first<{ n: number }>();
	return row?.n ?? 0;
}
