// 暗号にしたあとの長さから文字数が分からないよう、列ごとに決まった長さまで詰め物をする（cloudflare.md 2章）。
// 上限の文字数を UTF-8 の4バイトずつで数え、詰め物の印の1バイトを足しても収まる大きさ（テストで確かめている）。
// この値は暗号の形の一部なので、変えると前のしおりが読めなくなる
export const sealedColumnBytes = {
	'trips.title': 192,
	'trips.start_date': 16,
	'trips.end_date': 16,
	'members.name': 96
} as const satisfies Record<string, number>;

export type SealedColumn = keyof typeof sealedColumnBytes;

export const sealedFormat = 'v1';
export const ivBytes = 12;
const tagBytes = 16;

function base64UrlLength(bytes: number): number {
	return Math.ceil((bytes * 4) / 3);
}

export function sealedLength(column: SealedColumn): number {
	return (
		sealedFormat.length +
		1 +
		base64UrlLength(ivBytes) +
		1 +
		base64UrlLength(sealedColumnBytes[column] + tagBytes)
	);
}

const sealedPattern = new RegExp(
	`^${sealedFormat}\\.[A-Za-z0-9_-]{${String(base64UrlLength(ivBytes))}}\\.[A-Za-z0-9_-]+$`
);

// サーバーは中身を読めないので、暗号文の形と長さだけを確かめる
export function isSealed(column: SealedColumn, value: string): boolean {
	return value.length === sealedLength(column) && sealedPattern.test(value);
}

export const nameIndexPattern = /^[0-9a-f]{64}$/;
