import { toBase64Url } from './base64url.js';

// 128 ビット（cloudflare.md 2章）。base64url にすると 22 文字で、最後の文字は使わないビットが 4 つあるので A・Q・g・w のどれかになる
const keyBytes = 16;
const tripKeyPattern = /^[A-Za-z0-9_-]{21}[AQgw]$/;

export function generateTripKey(): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(keyBytes)));
}

export function isTripKey(value: string): boolean {
	return tripKeyPattern.test(value);
}
