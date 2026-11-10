import { describe, expect, it } from 'vitest';
import { isSealed, sealedLength } from './sealed-format.js';
import { createTripCrypto } from './trip-crypto.js';
import { generateTripKey } from './trip-key.js';

describe('暗号文の形', () => {
	it.each([
		['trips.title', 298],
		['trips.start_date', 63],
		['trips.end_date', 63],
		['members.name', 170]
	] as const)('%s の暗号文は %d 文字（D1 の CHECK と同じ）', (column, length) => {
		expect(sealedLength(column)).toBe(length);
	});

	it('作った暗号文を、正しい形として受け付ける', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(isSealed('members.name', await tripCrypto.seal('members.name', 1, 1, 'はると'))).toBe(
			true
		);
	});

	it('ほかの列の長さの暗号文は受け付けない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(isSealed('members.name', await tripCrypto.seal('trips.title', 1, 1, '海'))).toBe(false);
	});

	it('暗号文でない文字は受け付けない', () => {
		expect(isSealed('members.name', 'はると')).toBe(false);
	});

	it('版の違う暗号文は受け付けない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const sealed = await tripCrypto.seal('members.name', 1, 1, 'はると');
		expect(isSealed('members.name', `v2${sealed.slice(2)}`)).toBe(false);
	});
});
