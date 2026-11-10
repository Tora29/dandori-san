// 札は 32 バイト。base64url にすると 43 文字で、最後の文字は使わないビットが 2 つある
const accessTokenPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export function isAccessToken(value: string): boolean {
	return accessTokenPattern.test(value);
}
