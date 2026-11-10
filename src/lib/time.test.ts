import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, deleteOnFor, isValidDate, tokyoDate, tokyoTime } from './time.js';

describe('日本時間の日にちと時刻', () => {
	it('UTC では前の日でも、日本時間の日にちを返す', () => {
		expect(tokyoDate(Date.UTC(2026, 2, 9, 22, 0))).toBe('2026-03-10');
	});

	it('UTC で同じ日の15時を過ぎると、日本時間では次の日になる', () => {
		expect(tokyoDate(Date.UTC(2026, 2, 10, 15, 0))).toBe('2026-03-11');
	});

	it('UTC の 14:59 は日本時間の 23:59、15:00 は次の日の 00:00', () => {
		expect(tokyoDate(Date.UTC(2026, 2, 10, 14, 59))).toBe('2026-03-10');
		expect(tokyoTime(Date.UTC(2026, 2, 10, 14, 59))).toBe('23:59');
		expect(tokyoDate(Date.UTC(2026, 2, 10, 15, 0))).toBe('2026-03-11');
		expect(tokyoTime(Date.UTC(2026, 2, 10, 15, 0))).toBe('00:00');
	});

	it('0時台を 24 時ではなく 00 時で返す', () => {
		expect(tokyoTime(Date.UTC(2026, 2, 9, 15, 30))).toBe('00:30');
	});

	it('時と分を2桁で返す', () => {
		expect(tokyoTime(Date.UTC(2026, 2, 10, 0, 5))).toBe('09:05');
	});
});

describe('本当にある日か', () => {
	it.each([
		['2026-03-10', true],
		['2028-02-29', true],
		['2027-02-29', false],
		['2026-02-30', false],
		['2026-13-01', false],
		['2026-00-10', false],
		['2026-3-10', false],
		['2026-03-10T00:00', false],
		['', false]
	])('%s は %s', (date, expected) => {
		expect(isValidDate(date)).toBe(expected);
	});
});

describe('消す日（cloudflare.md 4章）', () => {
	it.each([
		['2026-03-10', '2026-06-30'],
		['2026-03-31', '2026-06-30'],
		['2026-08-31', '2026-11-30'],
		['2026-11-30', '2027-02-28'],
		['2027-11-30', '2028-02-29'],
		['2026-12-31', '2027-03-31'],
		['2026-10-01', '2027-01-31']
	])('最終日が %s なら %s', (endDate, deleteOn) => {
		expect(deleteOnFor(endDate)).toBe(deleteOn);
	});
});

describe('月を足す', () => {
	it('月末を超えるときは、その月の末日にする', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
	});

	it.each([
		['2026-03-31', -1, '2026-02-28'],
		['2026-01-15', -12, '2025-01-15'],
		['2026-01-15', -13, '2024-12-15'],
		['2028-02-29', 12, '2029-02-28'],
		['2027-12-31', 2, '2028-02-29']
	])('%s に %d か月を足すと %s', (date, months, expected) => {
		expect(addMonths(date, months)).toBe(expected);
	});

	it('形の違う日にちは受け付けない', () => {
		expect(() => addMonths('2026-02-30', 1)).toThrow(RangeError);
	});
});

describe('日にちの差', () => {
	it.each([
		['2026-03-10', '2026-03-10', 0],
		['2026-03-10', '2026-03-12', 2],
		['2026-02-27', '2026-03-02', 3],
		['2026-12-31', '2027-01-01', 1],
		['2026-03-12', '2026-03-10', -2]
	])('%s から %s は %d 日', (from, to, days) => {
		expect(daysBetween(from, to)).toBe(days);
	});
});
