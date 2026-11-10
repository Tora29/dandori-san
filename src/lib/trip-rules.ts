import * as z from 'zod';
import { addMonths, daysBetween, deleteOnFor, isValidDate } from './time.js';
import {
	futureMonths,
	nameMaxLength,
	pastMonths,
	titleMaxLength,
	tripMaxDays
} from './trip-limits.js';

// CSP で script-src に unsafe-eval を許さないため、zod が new Function を試さないようにする（cloudflare.md 2章）
z.config({ jitless: true });

// ---- 書くとき（code.md 5章）----

// 見えない文字・改行・文字の向きを変える文字・私用の文字・まだ割り当ての無い文字は通さない。
// 名前を別の名前に見せかけたり、送る文を崩したりできるため。絵文字の中で使う分は、絵文字の決まりで通す
const forbiddenCharacters =
	/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;
const emoji = /^\p{RGI_Emoji}$/v;
// 点字の空白（U+2800）は、空白に見えるのに White_Space に入らない
const visibleCharacter = /[^\p{White_Space}\u2800]/u;
const combiningMark = /\p{M}/gu;
// 1文字に重ねる結合文字（濁点など）の数。重ねすぎると、上下の行にはみ出して隠せるため
const maxMarksPerCharacter = 3;
const graphemes = new Intl.Segmenter('ja', { granularity: 'grapheme' });

function hasOnlyAllowedCharacters(value: string): boolean {
	for (const { segment } of graphemes.segment(value)) {
		if (emoji.test(segment)) {
			continue;
		}
		if (forbiddenCharacters.test(segment)) {
			return false;
		}
		if ((segment.match(combiningMark)?.length ?? 0) > maxMarksPerCharacter) {
			return false;
		}
	}
	return true;
}

// 見た目の1文字ではなく、コードポイントで数える。絵文字をつないだ長い1文字で、暗号文の決まった長さを超えないように
export function characterCount(value: string): number {
	return Array.from(value).length;
}

// 見た目が同じ文字を同じものとして扱うため、前後の空白を取って NFC にそろえてから確かめる
function cleanText(maxLength: number) {
	return (
		z
			.string()
			.trim()
			.normalize('NFC')
			// 空のときに「入れてください」だけを出すため、文字の決まりは空の文字を通す
			.refine((value) => visibleCharacter.test(value), { error: '入れてください' })
			.refine(hasOnlyAllowedCharacters, { error: '使えない文字が入っています' })
			.refine((value) => characterCount(value) <= maxLength, {
				error: `${String(maxLength)}文字までにしてください`
			})
	);
}

export const titleSchema = cleanText(titleMaxLength);
export const nameSchema = cleanText(nameMaxLength);

export function newTripSchema(today: string) {
	const earliest = addMonths(today, -pastMonths);
	const latest = addMonths(today, futureMonths);
	return (
		z
			.object({
				title: titleSchema,
				organizerName: nameSchema,
				startDate: z.string(),
				endDate: z.string()
			})
			// 旅の名前などがまちがっていても、日にちのまちがいも一緒に知らせるため、日にちが文字なら確かめる
			.superRefine(
				({ startDate, endDate }, context) => {
					const issue = (path: 'startDate' | 'endDate', message: string) => {
						context.addIssue({ code: 'custom', path: [path], message });
					};
					if (!isValidDate(startDate)) {
						issue('startDate', '日にちを選んでください');
					}
					if (!isValidDate(endDate)) {
						issue('endDate', '日にちを選んでください');
					}
					if (!isValidDate(startDate) || !isValidDate(endDate)) {
						return;
					}
					if (daysBetween(earliest, startDate) < 0) {
						issue('startDate', `${String(pastMonths / 12)}年より前の旅行は作れません`);
					} else if (daysBetween(endDate, latest) < 0) {
						issue('endDate', `${String(futureMonths / 12)}年より先の旅行は作れません`);
					} else if (daysBetween(startDate, endDate) < 0) {
						issue('endDate', '終わりの日は、はじめの日と同じか、後にしてください');
					} else if (daysBetween(startDate, endDate) >= tripMaxDays) {
						issue('endDate', `${String(tripMaxDays)}日までにしてください`);
					} else if (daysBetween(today, deleteOnFor(endDate)) <= 0) {
						issue('endDate', '終わってから3か月より前の旅行は作れません');
					}
				},
				{ when: ({ value }) => hasDateStrings(value) }
			)
	);
}

function hasDateStrings(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		'startDate' in value &&
		'endDate' in value &&
		typeof value.startDate === 'string' &&
		typeof value.endDate === 'string'
	);
}

export type NewTrip = z.input<ReturnType<typeof newTripSchema>>;

// ---- 読むとき（code.md 5章）----
// 書くときの決まりは、端末の Unicode の版で答えが変わる（新しい絵文字を、古い端末は「まだ割り当ての無い文字」と見る）。
// 読むときは、どの端末でも答えが変わらない決まりだけで確かめ、合わない欄だけを「表示できない」にする

// 制御文字・行や段落の区切り・文字の向きを変える文字。どれも昔から決まっていて、版で変わらない
const unreadableCharacters = /[\p{Cc}\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/u;

export function isReadableText(value: string, maxLength: number): boolean {
	const count = characterCount(value);
	return (
		value.isWellFormed() && count >= 1 && count <= maxLength && !unreadableCharacters.test(value)
	);
}

export function areReadableDates(startDate: string, endDate: string): boolean {
	if (!isValidDate(startDate) || !isValidDate(endDate)) {
		return false;
	}
	const days = daysBetween(startDate, endDate);
	return days >= 0 && days < tripMaxDays;
}
