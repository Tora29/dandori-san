import { describe, expect, it } from 'vitest';
import { generateTripKey, isTripKey } from './trip-key.js';

describe('しおりの鍵', () => {
	it('URL で使える 22 文字にする', () => {
		const tripKey = generateTripKey();
		expect(tripKey).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(isTripKey(tripKey)).toBe(true);
	});

	it('毎回ちがう鍵を作る', () => {
		const tripKeys = new Set(Array.from({ length: 1000 }, generateTripKey));
		expect(tripKeys.size).toBe(1000);
	});

	it.each([
		'',
		'a'.repeat(21),
		'a'.repeat(23),
		`${'a'.repeat(21)}+`,
		`${'a'.repeat(21)}=`,
		// 使わないビットが 0 でない、同じ鍵の別の書き方
		`${'a'.repeat(21)}B`
	])('%s は鍵として受け付けない', (value) => {
		expect(isTripKey(value)).toBe(false);
	});
});
