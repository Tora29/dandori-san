// D1 のエラーの文から、どの UNIQUE の決まりに当たったかを読む（SQLite は「UNIQUE constraint failed: trips.id」の形で返す）。
// 端末が作った ID がぶつかったときに、端末に作り直してもらうため
export function uniqueViolation(error: unknown): string | null {
	const messages: string[] = [];
	for (let current: unknown = error; current instanceof Error; current = current.cause) {
		messages.push(current.message);
	}
	return /UNIQUE constraint failed: ([\w.]+)/.exec(messages.join('\n'))?.[1] ?? null;
}
