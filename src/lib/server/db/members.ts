import { membersMaxCount } from '#lib/trip-limits.js';
import { newMemberRecordSchema, type MemberRecord } from '#lib/trip-records.js';
import * as z from 'zod';
import { uniqueViolation } from './constraint.js';
import { memberRowSchema, type Row } from './row.js';

export type AddMemberResult =
	| { kind: 'added'; member: MemberRecord }
	| { kind: 'nameTaken' }
	| { kind: 'tooMany' }
	| { kind: 'invalidAddedBy' }
	| { kind: 'idTaken' }
	| { kind: 'missing' };

const stateSchema = z.object({ count: z.int(), taken: z.int(), added_by_ok: z.int() });

// 名前を入れた順に並べる（精算で額が同じときの順にも使う。features.md 7章）。
// 消す日を過ぎたしおりは、消す前でも読ませない（cloudflare.md 4章）
export async function listMembers(
	db: D1Database,
	accessHash: string,
	today: string
): Promise<MemberRecord[]> {
	const { results } = await db
		.prepare(
			`SELECT members.id, members.trip_id, members.name_sealed, members.name_index, members.added_by, members.version
			FROM members
			JOIN trips ON trips.id = members.trip_id
			WHERE trips.access_hash = ? AND trips.delete_on > ?
			ORDER BY members.seq`
		)
		.bind(accessHash, today)
		.all<Row>();
	return results.map((row) => memberRowSchema.parse(row));
}

// input は端末から届いた値なので、形を確かめるまで型を付けない（code.md 4章）。
// 足せなかった理由は、足す文と同じ batch の中で調べ、あいだにほかの人が足しても理由がずれないようにする
export async function addMember(
	db: D1Database,
	accessHash: string,
	input: unknown,
	today: string
): Promise<AddMemberResult> {
	const member = newMemberRecordSchema.parse(input);
	let results: D1Result<Row>[];
	try {
		results = await db.batch<Row>([
			// しおりは札からだけ決め、足した人もそのしおりの人のときだけ入れる（cloudflare.md 1章）。
			// SQLite は、INSERT … SELECT に WHERE が無いと ON CONFLICT を読みちがえるので、WHERE を消さない
			db
				.prepare(
					`INSERT INTO members (id, trip_id, seq, name_sealed, name_index, added_by)
					SELECT ?2, trips.id,
						(SELECT coalesce(max(seq), 0) + 1 FROM members WHERE members.trip_id = trips.id),
						?3, ?4, ?5
					FROM trips
					WHERE trips.access_hash = ?1 AND trips.delete_on > ?7
						AND (?5 IS NULL OR EXISTS (
							SELECT 1 FROM members WHERE members.id = ?5 AND members.trip_id = trips.id
						))
						AND (SELECT count(*) FROM members WHERE members.trip_id = trips.id) < ?6
					ON CONFLICT (trip_id, name_index) DO NOTHING
					RETURNING id, trip_id, name_sealed, name_index, added_by, version`
				)
				.bind(
					accessHash,
					member.id,
					member.nameSealed,
					member.nameIndex,
					member.addedBy,
					membersMaxCount,
					today
				),
			db
				.prepare(
					`SELECT
						(SELECT count(*) FROM members WHERE members.trip_id = trips.id) AS count,
						(SELECT count(*) FROM members WHERE members.trip_id = trips.id AND members.name_index = ?2) AS taken,
						(?3 IS NULL OR EXISTS (
							SELECT 1 FROM members WHERE members.id = ?3 AND members.trip_id = trips.id
						)) AS added_by_ok
					FROM trips WHERE trips.access_hash = ?1 AND trips.delete_on > ?4`
				)
				.bind(accessHash, member.nameIndex, member.addedBy, today)
		]);
	} catch (error) {
		if (uniqueViolation(error) === 'members.id') {
			return { kind: 'idTaken' };
		}
		throw error;
	}
	const inserted = results[0]?.results[0];
	if (inserted !== undefined) {
		return { kind: 'added', member: memberRowSchema.parse(inserted) };
	}
	const stateRow = results[1]?.results[0];
	if (stateRow === undefined) {
		return { kind: 'missing' };
	}
	const state = stateSchema.parse(stateRow);
	if (state.taken > 0) {
		return { kind: 'nameTaken' };
	}
	if (state.added_by_ok === 0) {
		return { kind: 'invalidAddedBy' };
	}
	return state.count >= membersMaxCount ? { kind: 'tooMany' } : { kind: 'missing' };
}
