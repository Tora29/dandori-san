import { describe, expect, it } from 'vitest';
import { randomId } from './random-id.js';

describe('乱数の ID', () => {
	it('JS の数のまま扱える、1 以上 2^52 以下の整数にする', () => {
		for (let i = 0; i < 1000; i += 1) {
			const id = randomId();
			expect(Number.isSafeInteger(id)).toBe(true);
			expect(id).toBeGreaterThanOrEqual(1);
			expect(id).toBeLessThanOrEqual(2 ** 52);
		}
	});

	it('毎回ちがう ID にする', () => {
		expect(new Set(Array.from({ length: 1000 }, randomId)).size).toBe(1000);
	});
});
