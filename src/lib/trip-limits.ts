// 文字数・日数・人数の上限（code.md 5章、cloudflare.md 3章・4章）。端末とサーバーの両方で使う

export const titleMaxLength = 40;
export const nameMaxLength = 20;
export const tripMaxDays = 14;

// 作れる旅行の日にちの範囲。遠い先にして、いつまでも消えないしおりを作られないように
export const pastMonths = 12;
export const futureMonths = 24;

// 消す日は、最終日のこの月数あとの月の末日
export const deleteAfterMonths = 3;

// リンクを知る人がいたずらで足し続け、D1 の1日の書き込みの上限を使い切るのを防ぐ
export const membersMaxCount = 50;
