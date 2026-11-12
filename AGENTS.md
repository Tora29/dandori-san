## 基本ルール

- 複数エージェントに分けて作業する方が効率が良いと判断される場合にはサブエージェントを起動して作業させること
- 資料のレビュー、誤字脱字の確認等の単一ファイルでの作業かつ、単純作業の場合はHaiku を指定してサブエージェントを起動すること

## 段取りさん

グループ旅行の当日に、みんなが迷わないしおり。
幹事がしおりを作ってリンクを配ると、リンクを知っている人はだれでも、登録もアプリも無しで見て書ける。
予定が変わったら、直した人がスマホの共有の画面から、LINE などでみんなに知らせる。
しおりは、旅行の最終日から3か月で自動で消える。
しおりの中身は、リンクの `#` の後ろにある鍵で端末の中で暗号にし、運営者にも読めない形で預かる。

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
| 暗号 | ブラウザと Workers の Web Crypto（AES-GCM・HKDF・HMAC・SHA-256）。鍵は端末の中だけで使う |
| 電波がないとき | SvelteKit の Service Worker（しおりは暗号文のまま保存する） |
| 入力の確かめ | Zod 4（中身は端末で、送られた記録の形はサーバーで確かめる） |
| テスト | Vitest、`@cloudflare/vitest-plugin`、Playwright（Chromium と WebKit）、axe |
| 整形・lint | Prettier、ESLint |
| 安全の検査 | Semgrep（OWASP Top 10 のルール集と、`.semgrep/` に置く自分のルール）。CI で動かし、見つかったら止める。ルール集は SvelteKit と D1 をほとんど見ないので、D1 は自分のルール、画面は ESLint で補う。ルール集は毎回最新を取るので、コードを変えていなくても急に落ちることがある |
| 公開 | GitHub Actions から wrangler で |
| ドメイン | `dandori-san.com` |
| 問い合わせ | Cloudflare Email Routing（`dandori-san.com` のアドレスに来たメールを、自分のメールに転送する） |

使う版は、2026-10 時点の SvelteKit 3 系（3.1 以上）、`@sveltejs/adapter-cloudflare` 8 系、Svelte 5（5.57 以上）、Vite 8、Vitest 5、wrangler 4 系、Zod 4。
Node は `.node-version` の版（今は 24）を、npm は 11.18 以上を使う。
版を上げるかは人が決める。
`package-lock.json` はコミットする。

### 対応するブラウザ

Safari 17・iOS 17、Chrome と Edge 120、Firefox 125 から（`vite.config.ts` の `build.target`）。
入力の確かめで、正規表現の `v` フラグと `Intl.Segmenter` を使うため。
iOS 16 で止まる端末（iPhone 8・X）は、対象から外している。

### 依存パッケージの決まり

- 新しい版は、出てから7日待って入れる。
  `npm install`・`npm update` で版を選ぶときは `.npmrc` の `min-release-age` が効き、Dependabot は `cooldown` で待つ。
  `npm ci` は `package-lock.json` のまま入れるので、この決まりは効かない

- 依存パッケージのインストールのスクリプトは、`package.json` の `allowScripts` で1つずつ決める。
  決めていないものが来たら、`.npmrc` の `strict-allow-scripts` で止まる（npm 11.16 から効き、11.18 で抜け道が塞がった）

- GitHub Actions は、タグではなくコミットの SHA で固定する。
  CI のコンテナのイメージは digest で固定する

- `@playwright/test` は、CI の Playwright のイメージと版をそろえるので、Dependabot では上げず、イメージと一緒に手で上げる

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
| `.claude/rules/code.md` | 言葉とコードの名前・時刻と日にち・置き場所・書き方・入力の確かめ方 |
| `.claude/rules/features.md` | 画面ごとの動き（当日の判定・変わった所の印・割り勘など） |
| `.claude/rules/git-workflow.md` | ブランチ・コミット・PR |
