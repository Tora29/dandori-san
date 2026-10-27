## 基本ルール

- 複数エージェントに分けて作業する方が効率が良いと判断される場合にはサブエージェントを起動して作業させること
- 資料のレビュー、誤字脱字の確認等の単一ファイルでの作業かつ、単純作業の場合はHaiku を指定してサブエージェントを起動すること

## 段取りさん

グループ旅行の当日に、みんなが迷わないしおり。
幹事がしおりを作ってリンクを配ると、リンクを知っている人はだれでも、登録もアプリも無しで見て書ける。
予定が変わったら、直した人がスマホの共有の画面から、LINE などでみんなに知らせる。
しおりは、旅行の最終日から3か月で自動で消える。

## 技術スタック

| 役割 | 使うもの |
| --- | --- |
| 画面 | SvelteKit 3（Svelte 5） |
| 置き場所 | Cloudflare Workers（`@sveltejs/adapter-cloudflare` 8） |
| データ | Cloudflare D1。ORM は使わず、SQL を直接書く |
| マイグレーション | wrangler の D1 マイグレーション |
| 設定 | `wrangler.jsonc`（D1・Cron・独自ドメイン・環境） |
| 自動削除 | 削除だけをする小さな Worker（Cron で1日1回） |
| みんなに知らせる | スマホの共有の画面（`navigator.share`）を開く。送る文は段取りさんが作る。開けないブラウザでは、送る文をコピーする |
| 電波がないとき | SvelteKit の Service Worker |
| テスト | Vitest、`@cloudflare/vitest-plugin`、Playwright、axe |
| 公開 | GitHub Actions から wrangler で |
| ドメイン | `dandori-san.com` |
| 問い合わせ | Cloudflare Email Routing（`dandori-san.com` のアドレスに来たメールを、自分のメールに転送する） |

使う版は、2026-10 時点の SvelteKit 3.0 系、`@sveltejs/adapter-cloudflare` 8 系、Svelte 5（5.57 以上）、Vite 8、wrangler 4 系。
版を上げるかは人が決める。
`package-lock.json` はコミットする。

## 使わないもの

ここにない技術・パッケージ・Cloudflare の機能を足すときは、先に人に確認する。
特に次のものは、使わないと決めている。

- WebSocket・Durable Objects（リアルタイムの配信は持たない。開いたときに最新を取る）
- ORM（Prisma・Drizzle など）
- ログイン・会員登録
- 使われ方の計測・広告・外のエラー記録のサービス
- Terraform・OpenTofu（設定は `wrangler.jsonc` で持つ）
- Web フォント・アニメーション・UI の部品集（見た目は Material 3 の決まりだけ借りる）

## ルール

| ファイル | 中身 |
| --- | --- |
| `.claude/rules/design-principles.md` | 見た目 |
| `.claude/rules/accessibility.md` | アクセシビリティ（WCAG 2.1 AA） |
| `.claude/rules/sveltekit.md` | SvelteKit と Svelte の書き方 |
| `.claude/rules/cloudflare.md` | D1・リンク・自動削除・wrangler の設定 |
| `.claude/rules/git-workflow.md` | ブランチ・コミット・PR |
