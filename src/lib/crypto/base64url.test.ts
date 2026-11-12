// 実装とは別に、Node の書き方で作った値と比べるため、テストでだけ Buffer を読む
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { fromBase64Url, toBase64Url } from './base64url.js';

describe('base64url', () => {
	it.each(Array.from({ length: 40 }, (_, length) => length))(
		'%d バイトを、Node と同じ文字にして元に戻せる',
		(length) => {
			const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256);
			const encoded = toBase64Url(bytes);
			expect(encoded).toBe(Buffer.from(bytes).toString('base64url'));
			expect(fromBase64Url(encoded)).toEqual(bytes);
		}
	);

	it.each([
		['使わないビットが 0 でない', 'AB'],
		['余った1文字', 'AAAAA'],
		['base64 の + と /', 'AA+/'],
		['= の詰め物', 'AA=='],
		['空白', 'AA AA']
	])('%s書き方は読まない', (_, value) => {
		expect(fromBase64Url(value)).toBeNull();
	});
});
