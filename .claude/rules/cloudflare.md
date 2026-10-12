# Cloudflare の約束事

D1・Workers・wrangler を使うときの決まり。
書き方の好みではなく、**守らないと壊れる・止まる・情報が漏れるもの**だけを書く。

## 1. D1

- D1 を読み書きする SQL は `#lib/server/db/`（`src/lib/server/db/`）の中にだけ書く。
  画面（`+page.server.ts` など）からは、そこにある関数だけを呼ぶ

- 値は必ずバインドする（`prepare(…).bind(…)`）。
  SQL の文字列に値をつなげない

- 2つ以上の書き込みは `env.DB.batch([...])` にまとめる。
  全部成功するか、全部失敗するかのどちらかになる。
  `BEGIN` などのトランザクションの SQL は D1 では使えない

- 保存するのは、使う人が「直す」「足す」などを押したときだけ。
  1文字打つごとに保存しない（1日の書き込みの上限に当たる）

- だれかが直したら、直した人の呼び名と、直す前の値を記録に残す。
  「変わった所」の表示と、まちがえて消したときに戻すのに使う

- 同時に直したときは、あとから保存した方が残る

- D1 の上限（下の出典）に気をつける。
  特に、1つのクエリのバインド変数は 100 個まで。
  1回の実行で送れるクエリの本数と、1つのデータベースの大きさにも上限がある

- テーブルの形を変えるときは、`migrations/` に SQL を足し、`wrangler d1 migrations apply` で当てる。
  前の形のデータに当てても壊れないかを、テストで確かめてから当てる

## 2. しおりのリンク

- しおりは、推測されないランダムな文字列で見分ける。
  `crypto.getRandomValues` で 128 ビット以上の乱数を作り、URL で使える文字にする

- 連番や作った時刻など、推測できる値を ID にしない

- リンクを知っている人は、だれでも見て書ける。
  リンクそのものが鍵の代わりなので、ログ・エラーの記録・コミット・PR・テストのデータに、本物のリンクを出さない

- しおりの URL を、ほかのサイトに送らない。
  `Referrer-Policy: no-referrer` を返す（しおりの中の地図などのリンクを押したとき、Referer でしおりの URL が相手に渡るため）

- しおりのページは、検索エンジンに載せない。
  `X-Robots-Tag: noindex` を返す（だれかがリンクを公開の場所に貼っても、検索に出ないようにするため）

- しおりのページと、しおりのデータを返す応答は、Cloudflare の配信側にキャッシュさせない。
  `Cache-Control: private, no-store` を返す（ほかの人に古いしおりや他人のしおりが返るのを防ぐ）

## 3. 回数の上限

- しおりの作成と書き込みに、同じ相手から短い間に送れる回数の上限を設ける。
  大量に作られたり書き込まれたりして、ほかの人が使えなくなるのを防ぐ

- 上限を超えたときは、「少し待ってから、もう一度やってください」と出す

- 上限の作り方（Cloudflare の Rate Limiting など）は、作るときに人と決める

## 4. 自動削除

- しおりは、旅行の最終日から1か月たったら消す

- 消す日は、しおりを作ったときと、日にちを変えたときに、しおりに書いておく

- 削除だけをする小さな Worker が、Cron で1日1回、消す日を過ぎたしおりと、それに付く予定・持ち物・立て替え・直した記録を、まとめて消す

- 消したしおりのリンクを開いたら、「このしおりは、旅行が終わってから1か月たったので消しました」と出す

## 5. 最新を取り直す

WebSocket を使わないので、次の3つのときに最新を取り直す。

- ページを開いたとき
- ほかのアプリやタブから戻ってきたとき（`visibilitychange`）
- 自分が書いたあと

## 6. 電波がないとき

- SvelteKit の Service Worker で、画面のファイルと、最後に見たしおりを端末に保存する。
  電波がなくても、最後の状態は見られるようにする

- 電波がなくて最新を取れないときは、いつの状態かを画面に出す（例：「10:05 の時点のしおりです」）

- iPhone の Safari は、7日間開かれなかったサイトの保存データを消す。
  旅行の前の日に一度開いてもらうよう、しおりの中で案内する

## 7. wrangler の設定

- Cloudflare の設定は `wrangler.jsonc` に書く。
  ダッシュボードで変えたものは、`wrangler.jsonc` に書き戻す

- D1 のデータベースは、最初に1回だけ `wrangler d1 create` で作り、出てきた ID を `wrangler.jsonc` に書く。
  ID を書かずに公開して、wrangler に自動で作らせない（D1 が二重にできる）

- 独自ドメインは、`wrangler.jsonc` の `routes`（`custom_domain: true`）で Worker に割り当てる。
  DNS のレコードと証明書は Cloudflare が自動で作るので、同じ名前の DNS レコードを手で作らない

- Cron は `triggers.crons` に書く。
  止めるときは `[]` にする（行を消したりコメントにしたりしても止まらない）

- 試験用の環境は `env.staging` で足す。
  D1 のつなぎ先などは、環境ごとに書き直す（親の設定から引き継がれない）

- 公開は GitHub Actions から行う。
  公開用の API トークンは、Workers の編集と D1 の編集の権限だけにする

- 秘密の値は `wrangler secret put` で入れる。
  `wrangler.jsonc` の `vars` に書かない（コミットされる）

---

## 出典

- D1 の上限：https://developers.cloudflare.com/d1/platform/limits/
- D1 の batch：https://developers.cloudflare.com/d1/worker-api/d1-database/
- wrangler の設定：https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers の独自ドメイン：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- wrangler の環境：https://developers.cloudflare.com/workers/wrangler/environments/
- Safari の保存データの扱い：https://webkit.org/blog/14403/updates-to-storage-policy/
