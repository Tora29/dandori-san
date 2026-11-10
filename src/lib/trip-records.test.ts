import { describe, expect, it } from 'vitest';
import { changedDeleteOnSchema, deleteOnSchema, tripRecordSchema } from './trip-records.js';

const today = '2026-10-01';

describe('送られた消す日', () => {
	it.each([
		['2027-02-28', true],
		['2026-10-31', true],
		// 今日から 24＋3 か月後の月の末日まで
		['2029-01-31', true],
		['2029-02-28', false],
		['2026-09-30', false],
		['2026-10-01', false],
		['2027-02-27', false],
		['9999-12-31', false],
		['abc', false]
	])('%s を受け付けるか：%s', (deleteOn, expected) => {
		expect(deleteOnSchema(today).safeParse(deleteOn).success).toBe(expected);
	});
});

describe('日にちを直したときの消す日', () => {
	it.each([
		// 今の消す日より後なら受け付ける
		['2027-02-28', '2027-03-31', true],
		// 今の消す日と、今日の3か月後の月末（2027-01-31）の、早い方より前にはずらせない
		['2027-02-28', '2027-01-31', true],
		['2027-02-28', '2026-12-31', false],
		['2027-02-28', '2026-10-31', false],
		// 今の消す日が遠い先なら、今日から3か月後の月末までは前にずらせる
		['2028-06-30', '2027-01-31', true],
		['2028-06-30', '2026-12-31', false]
	])('今の消す日が %s のとき、%s を受け付けるか：%s', (current, next, expected) => {
		expect(changedDeleteOnSchema(today, current).safeParse(next).success).toBe(expected);
	});
});

describe('サーバーから届いた記録', () => {
	it('形の違う記録は受け付けない', () => {
		expect(tripRecordSchema.safeParse({ id: 1, titleSealed: '山の旅' }).success).toBe(false);
	});
});
