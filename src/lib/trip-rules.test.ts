import { describe, expect, it } from 'vitest';
import { nameMaxLength, titleMaxLength, tripMaxDays } from './trip-limits.js';
import {
	areReadableDates,
	characterCount,
	isReadableText,
	nameSchema,
	newTripSchema,
	titleSchema
} from './trip-rules.js';

const today = '2026-10-01';

function messages(result: { error?: { issues: { message: string }[] } }): string[] {
	return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('書くとき：旅の名前', () => {
	it.each([
		['山の温泉めぐり', true],
		['あ'.repeat(titleMaxLength), true],
		['あ'.repeat(titleMaxLength + 1), false],
		['', false],
		['   ', false],
		['山の\n旅', false],
		['山の\t旅', false],
		['山の\u0000旅', false],
		['山の\u202E旅', false],
		['山の\u2067旅', false],
		['山の\u200F旅', false],
		['山の\u061C旅', false],
		['はると\u200B', false],
		['山の\u2028旅', false],
		['\u3164', false],
		['\u2800', false],
		['山の旅', false],
		['山の\uD800旅', false],
		['山の\u{E0041}旅', false]
	])('%j を受け付けるか：%s', (title, expected) => {
		expect(titleSchema.safeParse(title).success).toBe(expected);
	});

	it('前後の空白と改行は取って受け付ける', () => {
		expect(titleSchema.parse('  山の旅\n')).toBe('山の旅');
	});

	it('空のときは「入れてください」だけを出す', () => {
		expect(messages(titleSchema.safeParse(''))).toEqual(['入れてください']);
		expect(messages(titleSchema.safeParse('   '))).toEqual(['入れてください']);
	});

	it('絵文字は1文字として数え、つなぐ ZWJ・異体字セレクタ・旗も通す', () => {
		expect(characterCount('🍙'.repeat(titleMaxLength))).toBe(titleMaxLength);
		expect(titleSchema.safeParse('🍙'.repeat(titleMaxLength)).success).toBe(true);
		expect(titleSchema.safeParse('家族\u{1F468}\u200D\u{1F469}\u200D\u{1F467}の旅').success).toBe(
			true
		);
		expect(titleSchema.safeParse('❤\uFE0Fの旅').success).toBe(true);
		expect(titleSchema.safeParse('\u{1F1EF}\u{1F1F5}の旅').success).toBe(true);
	});

	// q には、結合文字とまとめた1文字が無いので、NFC にそろえても数が減らない
	it('結合文字は1文字に3つまで', () => {
		expect(titleSchema.safeParse(`q${'\u0301'.repeat(3)}`).success).toBe(true);
		expect(titleSchema.safeParse(`q${'\u0301'.repeat(4)}`).success).toBe(false);
	});

	it('文字数は、前後の空白を取ってから数える', () => {
		expect(titleSchema.safeParse(` ${'あ'.repeat(titleMaxLength)} `).success).toBe(true);
	});

	it('入れ物が文字でなければ受け付けない', () => {
		expect(titleSchema.safeParse(40).success).toBe(false);
	});
});

describe('書くとき：呼び名', () => {
	it.each([
		['はると', true],
		['あ'.repeat(nameMaxLength), true],
		['あ'.repeat(nameMaxLength + 1), false],
		['', false]
	])('%j を受け付けるか：%s', (name, expected) => {
		expect(nameSchema.safeParse(name).success).toBe(expected);
	});

	it('「か」と濁点の2文字は、「が」1文字にそろえる', () => {
		expect(nameSchema.parse('\u304B\u3099く')).toBe('\u304Cく');
	});

	it('そろえる前の文字数で、上限を超えたことにしない', () => {
		expect(nameSchema.safeParse('\u304B\u3099'.repeat(nameMaxLength)).success).toBe(true);
	});
});

describe('書くとき：旅行の日にち', () => {
	const base = { title: '山の旅', organizerName: 'はると' };

	it.each([
		['2026-11-03', '2026-11-03', true],
		['2026-11-01', '2026-11-14', true],
		['2026-11-01', '2026-11-15', false],
		['2026-11-05', '2026-11-03', false],
		['2026-02-28', '2026-02-30', false],
		['2026-12-31', '2027-01-02', true],
		['2026-11-3', '2026-11-05', false],
		['', '2026-11-05', false],
		// 終わってから3か月より前の旅行は、作った時点で消す日を過ぎているので作れない
		['2025-10-01', '2025-10-02', false],
		['2026-07-01', '2026-07-01', true],
		['2026-06-30', '2026-06-30', false],
		['2028-09-30', '2028-10-01', true],
		['2028-10-01', '2028-10-02', false],
		['9998-12-30', '9998-12-31', false],
		['1999-12-30', '1999-12-31', false]
	])('%s から %s を受け付けるか：%s', (startDate, endDate, expected) => {
		expect(newTripSchema(today).safeParse({ ...base, startDate, endDate }).success).toBe(expected);
	});

	it(`${String(tripMaxDays)}日を超えるまちがいは、終わりの日の欄に出す`, () => {
		const result = newTripSchema(today).safeParse({
			...base,
			startDate: '2026-11-01',
			endDate: '2026-11-15'
		});
		expect(result.error?.issues[0]?.path).toEqual(['endDate']);
	});

	it('名前と日にちの両方がまちがっていたら、両方を知らせる', () => {
		const result = newTripSchema(today).safeParse({
			title: '',
			organizerName: 'はると',
			startDate: '',
			endDate: ''
		});
		expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
			'title',
			'startDate',
			'endDate'
		]);
	});

	it('全部をそろえて返す', () => {
		expect(
			newTripSchema(today).parse({
				title: ' 山の旅 ',
				startDate: '2026-11-03',
				endDate: '2026-11-04',
				organizerName: '\u304B\u3099く'
			})
		).toEqual({
			title: '山の旅',
			startDate: '2026-11-03',
			endDate: '2026-11-04',
			organizerName: 'がく'
		});
	});
});

describe('読むとき（どの端末でも答えが変わらない決まり）', () => {
	it.each([
		['山の旅', true],
		// 新しい絵文字や、まだ割り当ての無い文字も、読むときは通す（端末の版で答えが変わるため）
		['\u{1FAEA}', true],
		['\u{10FFFD}', true],
		['', false],
		['山の\n旅', false],
		['山の\u2028旅', false],
		['山の\u202E旅', false],
		['山の\uD800旅', false],
		['あ'.repeat(titleMaxLength + 1), false]
	])('%j を読めるものとするか：%s', (value, expected) => {
		expect(isReadableText(value, titleMaxLength)).toBe(expected);
	});

	it.each([
		['2026-11-03', '2026-11-05', true],
		['2026-11-03', '2026-11-03', true],
		['2026-11-05', '2026-11-03', false],
		['2026-11-01', '2026-11-15', false],
		['2999-12-31', '2000-01-01', false],
		['2026-02-30', '2026-03-01', false]
	])('%s から %s を読めるものとするか：%s', (startDate, endDate, expected) => {
		expect(areReadableDates(startDate, endDate)).toBe(expected);
	});
});
