import { newTripRecordSchema, type TripRecord } from '#lib/trip-records.js';
import { uniqueViolation } from './constraint.js';
import { tripRowSchema, type Row } from './row.js';

export type CreateTripResult =
	| { kind: 'created'; trip: TripRecord }
	| { kind: 'idTaken' }
	| { kind: 'exists' }
	| { kind: 'deleted' };

// しおり・幹事・幹事の ID の書き戻しを1回の batch にし、途中で失敗しても半端なしおりを残さない。
// accessHash は札のハッシュ（#lib/server/access.ts）、today は日本時間の今日（code.md 2章）。
// input は端末から届いた値なので、形を確かめるまで型を付けない（code.md 4章）
export async function createTrip(
	db: D1Database,
	accessHash: string,
	input: unknown,
	today: string
): Promise<CreateTripResult> {
	// 中身は暗号文なので読めない。形と長さ、ID、消す日の範囲だけを確かめる
	const trip = newTripRecordSchema(today).parse(input);
	// 消したしおりの鍵を知る人が、同じリンクで別の中身のしおりを作れないように
	const deleted = await db
		.prepare('SELECT 1 FROM deleted_trips WHERE access_hash = ?')
		.bind(accessHash)
		.first();
	if (deleted !== null) {
		return { kind: 'deleted' };
	}
	try {
		const [, , updated] = await db.batch<Row>([
			db
				.prepare(
					`INSERT INTO trips (id, access_hash, title_sealed, start_date_sealed, end_date_sealed, delete_on)
					VALUES (?, ?, ?, ?, ?, ?)`
				)
				.bind(
					trip.id,
					accessHash,
					trip.titleSealed,
					trip.startDateSealed,
					trip.endDateSealed,
					trip.deleteOn
				),
			db
				.prepare(
					`INSERT INTO members (id, trip_id, seq, name_sealed, name_index)
					VALUES (?, ?, 1, ?, ?)`
				)
				.bind(trip.organizer.id, trip.id, trip.organizer.nameSealed, trip.organizer.nameIndex),
			db
				.prepare(
					`UPDATE trips SET organizer_id = ? WHERE id = ? AND access_hash = ?
					RETURNING id, title_sealed, start_date_sealed, end_date_sealed, organizer_id, delete_on, plans_revision, version`
				)
				.bind(trip.organizer.id, trip.id, accessHash)
		]);
		return { kind: 'created', trip: tripRowSchema.parse(updated?.results[0]) };
	} catch (error) {
		const violated = uniqueViolation(error);
		if (violated === 'trips.id' || violated === 'members.id') {
			return { kind: 'idTaken' };
		}
		if (violated === 'trips.access_hash') {
			return { kind: 'exists' };
		}
		throw error;
	}
}

export type FindTripResult =
	{ kind: 'found'; trip: TripRecord } | { kind: 'deleted' } | { kind: 'missing' };

// 消す Worker は1日1回なので、消す日を過ぎてから消すまでのあいだも、消したものとして扱う（cloudflare.md 4章）
export async function findTrip(
	db: D1Database,
	accessHash: string,
	today: string
): Promise<FindTripResult> {
	const [found, deleted] = await db.batch<Row>([
		db
			.prepare(
				`SELECT id, title_sealed, start_date_sealed, end_date_sealed, organizer_id, delete_on, plans_revision, version
				FROM trips WHERE access_hash = ?`
			)
			.bind(accessHash),
		db.prepare('SELECT 1 FROM deleted_trips WHERE access_hash = ?').bind(accessHash)
	]);
	const row = found?.results[0];
	if (row !== undefined) {
		const trip = tripRowSchema.parse(row);
		return trip.deleteOn <= today ? { kind: 'deleted' } : { kind: 'found', trip };
	}
	return (deleted?.results.length ?? 0) > 0 ? { kind: 'deleted' } : { kind: 'missing' };
}
