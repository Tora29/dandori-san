import { fromBase64Url, toBase64Url } from './base64url.js';
import { toHex } from './hex.js';
import { ivBytes, sealedColumnBytes, sealedFormat, type SealedColumn } from './sealed-format.js';
import { isTripKey } from './trip-key.js';

export interface TripCrypto {
	// サーバーに送る、しおりに入るための札。鍵そのものはサーバーに送らない（cloudflare.md 2章）
	readonly accessToken: string;
	readonly seal: (
		column: SealedColumn,
		rowId: number,
		version: number,
		plaintext: string
	) => Promise<string>;
	// 鍵が違う・書き換えられた・前の版に戻された暗号文は、読まずに null を返す
	readonly open: (
		column: SealedColumn,
		rowId: number,
		version: number,
		sealed: string
	) => Promise<string | null>;
	readonly nameIndex: (name: string) => Promise<string>;
}

const paddingMark = 0x80;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

// 同じしおりの中で、ほかの列・ほかの行の暗号文に差し替えられたり、前の版の暗号文に戻されたりしても読めないよう、
// 列・行・版を追加データに入れる。列の名前は暗号の形の一部なので、D1 の列の名前を変えても、ここは変えない
function additionalData(
	column: SealedColumn,
	rowId: number,
	version: number
): Uint8Array<ArrayBuffer> {
	return encoder.encode(`${sealedFormat}\0${column}\0${String(rowId)}\0${String(version)}`);
}

function pad(column: SealedColumn, plaintext: string): Uint8Array<ArrayBuffer> {
	const bytes = encoder.encode(plaintext);
	const size = sealedColumnBytes[column];
	if (bytes.length + 1 > size) {
		throw new RangeError(`${column} が長すぎます`);
	}
	const padded = new Uint8Array(size);
	padded.set(bytes);
	padded[bytes.length] = paddingMark;
	return padded;
}

function unpad(padded: Uint8Array): Uint8Array | null {
	let end = padded.length - 1;
	while (end >= 0 && padded[end] === 0) {
		end -= 1;
	}
	return padded[end] === paddingMark ? padded.subarray(0, end) : null;
}

// 全角と半角・大文字と小文字・空白だけが違う呼び名を、同じ呼び名として断るために比べる形（code.md 5章）
export function nameComparisonForm(name: string): string {
	return name.normalize('NFKC').toLowerCase().replace(/\s/gu, '');
}

// 鍵はリンクの # の後ろにあり、端末の中だけで使う（cloudflare.md 2章）。
// 暗号の鍵・呼び名を比べる鍵・札を、鍵から別々に作る
export async function createTripCrypto(tripKey: string): Promise<TripCrypto> {
	const keyBytes = isTripKey(tripKey) ? fromBase64Url(tripKey) : null;
	if (keyBytes === null) {
		throw new TypeError('鍵の形が違います');
	}
	const material = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, [
		'deriveKey',
		'deriveBits'
	]);
	const hkdf = (info: string) => ({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: encoder.encode('dandori-san'),
		info: encoder.encode(`${sealedFormat} ${info}`)
	});
	const [sealKey, indexKey, accessBits] = await Promise.all([
		crypto.subtle.deriveKey(hkdf('seal'), material, { name: 'AES-GCM', length: 256 }, false, [
			'encrypt',
			'decrypt'
		]),
		crypto.subtle.deriveKey(
			hkdf('name-index'),
			material,
			{ name: 'HMAC', hash: 'SHA-256', length: 256 },
			false,
			['sign']
		),
		crypto.subtle.deriveBits(hkdf('access'), material, 256)
	]);

	return {
		accessToken: toBase64Url(new Uint8Array(accessBits)),

		seal: async (column, rowId, version, plaintext) => {
			const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
			const ciphertext = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv, additionalData: additionalData(column, rowId, version) },
				sealKey,
				pad(column, plaintext)
			);
			return `${sealedFormat}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
		},

		open: async (column, rowId, version, sealed) => {
			const [format, ivText, ciphertextText, ...rest] = sealed.split('.');
			const iv = fromBase64Url(ivText ?? '');
			const ciphertext = fromBase64Url(ciphertextText ?? '');
			if (
				format !== sealedFormat ||
				iv?.length !== ivBytes ||
				ciphertext === null ||
				rest.length > 0
			) {
				return null;
			}
			try {
				const padded = await crypto.subtle.decrypt(
					{ name: 'AES-GCM', iv, additionalData: additionalData(column, rowId, version) },
					sealKey,
					ciphertext
				);
				const bytes = unpad(new Uint8Array(padded));
				return bytes === null ? null : decoder.decode(bytes);
			} catch {
				return null;
			}
		},

		nameIndex: async (name) =>
			toHex(await crypto.subtle.sign('HMAC', indexKey, encoder.encode(nameComparisonForm(name))))
	};
}
