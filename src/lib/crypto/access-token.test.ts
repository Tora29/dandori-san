import { describe, expect, it } from 'vitest';
import { isAccessToken } from './access-token.js';
import { createTripCrypto } from './trip-crypto.js';
import { generateTripKey } from './trip-key.js';

describe('札の形', () => {
	it('作った札を受け付ける', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(isAccessToken(tripCrypto.accessToken)).toBe(true);
	});

	it.each(['', 'A'.repeat(42), `${'A'.repeat(42)}B`, `${'A'.repeat(42)}A=`, 'A'.repeat(44)])(
		'%j は札として受け付けない',
		(value) => {
			expect(isAccessToken(value)).toBe(false);
		}
	);
});
