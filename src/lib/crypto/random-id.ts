// 連番にすると、ID の大きさから作った時期や件数が分かる（cloudflare.md 2章）。
// JS の数のまま扱えるよう 52 ビットにする
// randomId が返す一番大きい値
export const randomIdMax = 2 ** 52;

export function randomId(): number {
	const [high = 0, low = 0] = crypto.getRandomValues(new Uint32Array(2));
	return (high & 0xfffff) * 0x100000000 + low + 1;
}
