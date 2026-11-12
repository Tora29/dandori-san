// 実装とは別に、Node の書き方で作った値と比べるため、テストでだけ Buffer を読む
import { Buffer } from 'node:buffer';
import { createCipheriv, createHmac, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { nameMaxLength, titleMaxLength } from '../trip-limits.js';
import { sealedColumnBytes, type SealedColumn } from './sealed-format.js';
import { createTripCrypto, nameComparisonForm } from './trip-crypto.js';
import { generateTripKey } from './trip-key.js';

// 16 バイトの 0。最後の文字が A なので、鍵の形の決まりに合う
const fixedTripKey = 'AAAAAAAAAAAAAAAAAAAAAA';
const fixedIv = Buffer.from('000102030405060708090a0b', 'hex');

function derive(info: string): Buffer {
	return Buffer.from(hkdfSync('sha256', Buffer.alloc(16), 'dandori-san', info, 32));
}

// 実装とは別に、Node の暗号の関数で同じ形の暗号文を作る。暗号の形が変わって、前の暗号文が読めなくなるのを見つけるため
function referenceSeal(
	column: SealedColumn,
	rowId: number,
	version: number,
	plaintext: Buffer,
	options: { mark?: boolean } = {}
): string {
	const padded = Buffer.alloc(sealedColumnBytes[column]);
	plaintext.copy(padded);
	if (options.mark !== false) {
		padded[plaintext.length] = 0x80;
	}
	const cipher = createCipheriv('aes-256-gcm', derive('v1 seal'), fixedIv);
	cipher.setAAD(Buffer.from(`v1\0${column}\0${String(rowId)}\0${String(version)}`, 'utf8'));
	const ciphertext = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);
	return `v1.${fixedIv.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

describe('暗号の形（決まった値で確かめる）', () => {
	it('別に作った暗号文を読める', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		const sealed = referenceSeal('trips.title', 123, 1, Buffer.from('山の温泉めぐり'));
		await expect(tripCrypto.open('trips.title', 123, 1, sealed)).resolves.toBe('山の温泉めぐり');
	});

	it('呼び名の HMAC が、別に作った値と同じ', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		const expected = createHmac('sha256', derive('v1 name-index'))
			.update('haru', 'utf8')
			.digest('hex');
		await expect(tripCrypto.nameIndex('ＨＡＲＵ')).resolves.toBe(expected);
	});

	it('札が、別に作った値と同じ', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		expect(tripCrypto.accessToken).toBe(derive('v1 access').toString('base64url'));
	});

	it('詰め物の印が無い暗号文は読まない', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		const sealed = referenceSeal('trips.title', 1, 1, Buffer.from('海'), { mark: false });
		await expect(tripCrypto.open('trips.title', 1, 1, sealed)).resolves.toBeNull();
	});

	it('UTF-8 として壊れた中身は読まない', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		const sealed = referenceSeal('trips.title', 1, 1, Buffer.from([0xe3, 0x81]));
		await expect(tripCrypto.open('trips.title', 1, 1, sealed)).resolves.toBeNull();
	});
});

describe('詰め物の長さ', () => {
	it.each([
		['trips.title', titleMaxLength],
		['members.name', nameMaxLength]
	] as const)('%s は、上限の %d 文字を4バイトずつ数えて印を足しても収まる', (column, maxLength) => {
		expect(sealedColumnBytes[column]).toBeGreaterThanOrEqual(maxLength * 4 + 1);
	});

	it.each(['trips.start_date', 'trips.end_date'] as const)(
		'%s は、英数字だけの YYYY-MM-DD に印を足しても収まる',
		(column) => {
			expect(sealedColumnBytes[column]).toBeGreaterThanOrEqual('YYYY-MM-DD'.length + 1);
		}
	);
});

describe('暗号にして元に戻す', () => {
	it('同じ鍵・列・行・版なら元に戻せる', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const sealed = await tripCrypto.seal('trips.title', 1, 1, '山の温泉めぐり');
		await expect(tripCrypto.open('trips.title', 1, 1, sealed)).resolves.toBe('山の温泉めぐり');
	});

	it('暗号文に元の文字が入っていない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(await tripCrypto.seal('members.name', 1, 1, 'はると')).not.toContain('はると');
	});

	it('同じ文字でも、毎回ちがう暗号文にする', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const a = await tripCrypto.seal('members.name', 1, 1, 'はると');
		const b = await tripCrypto.seal('members.name', 1, 1, 'はると');
		expect(a).not.toBe(b);
	});

	it.each([
		['members.name', 'あ', 170],
		['members.name', '🍙'.repeat(nameMaxLength), 170],
		['trips.title', 'a', 298],
		['trips.title', '🍙'.repeat(titleMaxLength), 298],
		['trips.start_date', '2026-11-03', 63]
	] as const)(
		'%s の暗号文は、中身の長さによらず %s でも %d 文字',
		async (column, plaintext, length) => {
			const tripCrypto = await createTripCrypto(generateTripKey());
			expect(await tripCrypto.seal(column, 1, 1, plaintext)).toHaveLength(length);
		}
	);

	it('決まった長さに収まらない中身は、暗号にしない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		await expect(tripCrypto.seal('members.name', 1, 1, 'あ'.repeat(32))).rejects.toThrow(
			RangeError
		);
	});

	it('頭の BOM も、そのまま元に戻す', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const sealed = await tripCrypto.seal('trips.title', 1, 1, '\uFEFF山');
		await expect(tripCrypto.open('trips.title', 1, 1, sealed)).resolves.toBe('\uFEFF山');
	});
});

describe('差し替えや書き換えに気づく', () => {
	it('ほかのしおりの鍵では読めない', async () => {
		const sealed = await (
			await createTripCrypto(generateTripKey())
		).seal('trips.title', 1, 1, '海辺の旅');
		const other = await createTripCrypto(generateTripKey());
		await expect(other.open('trips.title', 1, 1, sealed)).resolves.toBeNull();
	});

	it('ほかの列の暗号文に差し替えられたら読めない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const sealed = await tripCrypto.seal('trips.start_date', 1, 1, '2026-11-03');
		await expect(tripCrypto.open('trips.end_date', 1, 1, sealed)).resolves.toBeNull();
	});

	it('同じしおりのほかの行の暗号文に差し替えられたら読めない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const sealed = await tripCrypto.seal('members.name', 1, 1, 'はると');
		await expect(tripCrypto.open('members.name', 2, 1, sealed)).resolves.toBeNull();
	});

	it('前の版の暗号文に戻されたら読めない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const old = await tripCrypto.seal('trips.title', 1, 1, '前の名前');
		await expect(tripCrypto.open('trips.title', 1, 2, old)).resolves.toBeNull();
	});

	it('暗号文の中身を書き換えられたら読めない', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		const [format, iv, ciphertext = ''] = (
			await tripCrypto.seal('trips.title', 1, 1, '海辺の旅')
		).split('.');
		const flipped = `${ciphertext.startsWith('A') ? 'B' : 'A'}${ciphertext.slice(1)}`;
		await expect(
			tripCrypto.open('trips.title', 1, 1, `${format ?? ''}.${iv ?? ''}.${flipped}`)
		).resolves.toBeNull();
	});

	it.each([
		'',
		'v2.AAAAAAAAAAAAAAAA.AAAA',
		'v1.AAAAAAAAAAAAAAAA',
		'v1.AAAA.AAAAAAAAAAAAAAAAAAAAAAAA',
		'v1.AAAAAAAAAAAAAAAA.AAAA.AAAA',
		'v1.AAAAAAAAAAAAAAAA.AA+A'
	])('形の違う暗号文 %j は読めない', async (sealed) => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		await expect(tripCrypto.open('trips.title', 1, 1, sealed)).resolves.toBeNull();
	});
});

describe('鍵', () => {
	it.each(['short', 'AAAAAAAAAAAAAAAAAAAAAB', 'AAAAAAAAAAAAAAAAAAAAA+'])(
		'形の違う鍵 %s からは作らない',
		async (tripKey) => {
			await expect(createTripCrypto(tripKey)).rejects.toThrow(TypeError);
		}
	);

	it('札は鍵と別の 43 文字で、鍵の文字を含まない', async () => {
		const tripCrypto = await createTripCrypto(fixedTripKey);
		expect(tripCrypto.accessToken).toHaveLength(43);
		expect(tripCrypto.accessToken).not.toContain(fixedTripKey);
	});
});

describe('呼び名の HMAC', () => {
	it.each([
		['か と濁点・が', '\u304B\u3099く', '\u304Cく'],
		['全角・半角', 'ＨＡＲＵ', 'haru'],
		['大文字・小文字', 'Haru', 'haru'],
		['半角のカタカナ・全角のカタカナ', 'ｶﾞｸ', 'ガク'],
		['空白あり・なし', 'は る と', 'はると']
	])('%s は、同じ呼び名として扱う', async (_, a, b) => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(await tripCrypto.nameIndex(a)).toBe(await tripCrypto.nameIndex(b));
	});

	it('ちがう呼び名は、ちがう値にする', async () => {
		const tripCrypto = await createTripCrypto(generateTripKey());
		expect(await tripCrypto.nameIndex('はると')).not.toBe(await tripCrypto.nameIndex('はるか'));
	});

	it('ほかのしおりでは、同じ呼び名でもちがう値にする', async () => {
		const a = await createTripCrypto(generateTripKey());
		const b = await createTripCrypto(generateTripKey());
		expect(await a.nameIndex('はると')).not.toBe(await b.nameIndex('はると'));
	});

	it('比べるための形にそろえる', () => {
		expect(nameComparisonForm('Ｈａ Ｒｕ')).toBe('haru');
	});
});
