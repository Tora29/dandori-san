const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes: Uint8Array): string {
	let result = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;
		const chunk = (a << 16) | (b << 8) | c;
		// 残りが 1・2・3 バイトなら、2・3・4 文字にする
		const chars = Math.min(bytes.length - i, 3) + 1;
		for (let j = 0; j < chars; j += 1) {
			result += alphabet.charAt((chunk >> (18 - j * 6)) & 63);
		}
	}
	return result;
}

// 同じバイトの書き方を1通りにするため、使わないビットが 0 でないものや、余った1文字は通さない
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
		return null;
	}
	const bytes = new Uint8Array(Math.floor((value.length * 3) / 4));
	let bits = 0;
	let bitCount = 0;
	let index = 0;
	for (const char of value) {
		bits = (bits << 6) | alphabet.indexOf(char);
		bitCount += 6;
		if (bitCount >= 8) {
			bitCount -= 8;
			bytes[index] = (bits >> bitCount) & 255;
			index += 1;
		}
		bits &= (1 << bitCount) - 1;
	}
	return bits === 0 ? bytes : null;
}
