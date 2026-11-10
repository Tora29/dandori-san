import { toHex } from '#lib/crypto/hex.js';

export { isAccessToken } from '#lib/crypto/access-token.js';

// D1 には札をそのまま置かず、SHA-256 にして置く（cloudflare.md 2章）。
// D1 が流出しても、そこから札を作って書き込めないようにするため
export async function hashAccessToken(accessToken: string): Promise<string> {
	return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken)));
}
