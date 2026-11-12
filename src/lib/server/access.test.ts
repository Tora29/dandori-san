import { describe, expect, it } from 'vitest';
import { hashAccessToken } from './access.js';

describe('札のハッシュ', () => {
	it('SHA-256 を 16 進の 64 文字で返す', async () => {
		// FIPS 180-2 のテストの値
		await expect(hashAccessToken('abc')).resolves.toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
});
