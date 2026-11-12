import * as z from 'zod';
import { randomIdMax } from './crypto/random-id.js';
import { isSealed, nameIndexPattern, type SealedColumn } from './crypto/sealed-format.js';
import { addMonths, daysBetween, endOfMonth, isValidDate } from './time.js';
import { deleteAfterMonths, futureMonths } from './trip-limits.js';

// 中身は暗号文のまま。サーバーは形だけを確かめ、端末はサーバーから届いた形を確かめる（cloudflare.md 2章、code.md 4章）

const id = z.int().min(1).max(randomIdMax);
const version = z.int().min(1);
const sealed = (column: SealedColumn) =>
	z.string().refine((value) => isSealed(column, value), { error: '暗号文の形が違います' });
const nameIndex = z.string().regex(nameIndexPattern);
// 形の違う日にちで、このあとの日にちの計算に進まないように止める
const date = z.string().refine(isValidDate, { abort: true });

export const tripRecordSchema = z.object({
	id,
	titleSealed: sealed('trips.title'),
	startDateSealed: sealed('trips.start_date'),
	endDateSealed: sealed('trips.end_date'),
	organizerId: id.nullable(),
	deleteOn: date,
	plansRevision: version,
	version
});

export type TripRecord = z.infer<typeof tripRecordSchema>;

export const memberRecordSchema = z.object({
	id,
	tripId: id,
	nameSealed: sealed('members.name'),
	nameIndex,
	addedBy: id.nullable(),
	version
});

export type MemberRecord = z.infer<typeof memberRecordSchema>;

// 消す日は端末で決めて送るので、サーバーは形と範囲だけを確かめる。
// 遠い先にして、いつまでも消えないしおりを作られないように（cloudflare.md 4章）
export function deleteOnSchema(today: string) {
	const latest = endOfMonth(addMonths(today, futureMonths + deleteAfterMonths));
	return date.refine(
		(value) =>
			endOfMonth(value) === value &&
			daysBetween(today, value) > 0 &&
			daysBetween(value, latest) >= 0,
		{ error: '消す日が決まりに合いません' }
	);
}

// 日にちを直すときは、消す日を前にずらして、旅行の前にしおりを消させることを防ぐ（cloudflare.md 4章）。
// ちゃんとした直しなら、今の消す日か、今日から3か月後の月末のどちらか早い方より前にはならない
export function changedDeleteOnSchema(today: string, currentDeleteOn: string) {
	const soonest = endOfMonth(addMonths(today, deleteAfterMonths));
	const floor = daysBetween(currentDeleteOn, soonest) < 0 ? soonest : currentDeleteOn;
	return deleteOnSchema(today).refine((value) => daysBetween(floor, value) >= 0, {
		error: '消す日を前にずらすことはできません'
	});
}

export const newMemberRecordSchema = z.object({
	id,
	nameSealed: sealed('members.name'),
	nameIndex,
	addedBy: id.nullable()
});

export type NewMemberRecord = z.infer<typeof newMemberRecordSchema>;

export function newTripRecordSchema(today: string) {
	return z.object({
		id,
		titleSealed: sealed('trips.title'),
		startDateSealed: sealed('trips.start_date'),
		endDateSealed: sealed('trips.end_date'),
		deleteOn: deleteOnSchema(today),
		organizer: newMemberRecordSchema.extend({ addedBy: z.null() })
	});
}

export type NewTripRecord = z.infer<ReturnType<typeof newTripRecordSchema>>;
