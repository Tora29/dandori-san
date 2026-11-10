# 脅威モデル: 段取りさん

## 1. 前提

段取りさんの仕様として許していることを、ここに書く。
ここに書いたことは、脅威として扱わない。

- しおりのリンクを知っている人は、だれでも見て書ける。
  ログインは無く、リンクそのものが鍵の代わりになる
- リンクを持つ人が、まちがえたり、いたずらしたりして中身を書き換えるのは、止めない。
  直した人と直す前の値を記録に残し、戻せるようにする（cloudflare.md 1章）
- 呼び名は、選ぶだけでその人として開ける。
  本人かどうかは確かめない（features.md 6章）
- 精算の「払った」は、だれでも押せる。
  押した人の呼び名を残す（features.md 8章）
- 「リンクを送る」と「みんなに知らせる」の文には、しおりのリンクを入れる。
  送った相手から先にリンクが広がるかは、使う人が決める
- サイトを落とすほどの大量の通信（DDoS）は、Cloudflare が受ける（cloudflare.md 3章）
- 端末そのものの乗っ取り、送り先のサービス（LINE など）の中、Cloudflare と GitHub の基盤そのものは、ここでは扱わない

## 2. 守るもの

- しおりのリンクの鍵
- しおりの中身（予定・場所・日にち・呼び名・持ち物・立て替え）。
  旅行の日にちと場所から、家を空ける日が分かる
- 旅行の当日に、しおりが開けて、正しい中身であること
- 直した記録（変わった所の印と、元に戻すのに使う）
- D1 の1日の書き込みの上限（使い切られると、みんなが書けなくなる）
- Cloudflare の API トークンなどの秘密の値と、公開の仕組み
- ソースコードと依存パッケージ（配る画面とサーバーに、悪いコードが入らないこと）

## 3. 攻める人

- しおりのリンクを持つ、一緒に行く人
- 転送や画面の写しで、しおりのリンクを手に入れた第三者
- リンクを持たない外の人
- 公開のリポジトリに Pull Request を送る外の人
- 依存パッケージ、GitHub Actions、CI のコンテナのイメージを乗っ取った人

## 4. 入口

- しおりの URL（鍵を含む）
- フォームと form actions（しおりを作る、予定などを足す・直す・消す）
- 応答と応答ヘッダー
- 人が入れた文字を出す所（予定・場所・メモ・呼び名）と、メモの中のリンク
- 送る文（端末の共有の画面、コピー）
- Service Worker と、端末に保存したしおり
- 自動削除の Worker（Cron）
- 依存パッケージ（npm）、GitHub Actions、CI のコンテナのイメージ
- リポジトリへの Pull Request

## 5. 脅威と対策

検知は、Pull Request と main への push で動く CI の検査（OSV-Scanner は週に1回も動く）と、GitHub の Secret scanning と Push protection。

| 脅威 | 起きること | 今の対策（ルールのファイルと章） | 検知の方法 |
|---|---|---|---|
| 人が入れた値を SQL の文字につなげて、D1 に好きな SQL を送る | ほかのしおりを読む・書き換える・消す | 値は `?` で書いて `bind()` で渡す（cloudflare.md 1章） | Semgrep（`.semgrep/d1.yml` の `d1-sql-built-from-values`、`p/owasp-top-ten`、`p/default`） |
| 人が入れた文字（予定・メモ・呼び名）が、HTML として動く | 開いた人の画面で、しおりのリンクを抜かれる | 人が入れた文字を `{@html}` で出さない（sveltekit.md 4章） | ESLint（`svelte/no-at-html-tags`、`innerHTML` などへの代入と `document.write` の禁止） |
| 目に見えない文字や、文字の向きを変える文字をコードに入れ、レビューで読む人をだます | 見た目と違う動きのコードが入る | 見えない文字は `\u` の書き方にする（`.semgrep/hidden-characters.yml`） | Semgrep（`hidden-characters`） |
| コメントで ESLint の規則を外し、穴のある書き方を通す | 上の ESLint の検知をすり抜ける | コメントで規則を外せない設定にする（`eslint.config.js` の `noInlineConfig`、Svelte の `svelte-ignore` と HTML の `eslint-disable` の禁止） | ESLint |
| 既知の脆弱性がある版や、悪いコードが入っていると分かっている版の依存パッケージを入れる | サーバーや画面で悪いコードが動く | `package-lock.json` をコミットし、CI は `npm ci` で入れる（AGENTS.md）。新しい版は出てから7日待つ（`.npmrc` の `min-release-age`） | OSV-Scanner（Pull Request ごとと、週に1回） |
| npm に公開されたものと違う中身のパッケージを入れる | CI や手元で悪いコードが動く | CI はスクリプトを止めて入れてから確かめる（`npm ci --ignore-scripts`） | `npm audit signatures`（CI） |
| 依存パッケージのインストールのスクリプトで、悪いコードを動かす | CI や手元で悪いコードが動き、秘密の値を抜かれる | スクリプトを動かしてよいパッケージを1つずつ決める（`.npmrc` の `strict-allow-scripts`、`package.json` の `allowScripts`） | 決めていないスクリプトがあると、npm が入れるのを止める |
| GitHub Actions のタグを、乗っ取った人が別のコードに差し替える | CI で悪いコードが動く | Actions はタグではなくコミットの SHA で固定し、Dependabot で上げる（`.github/dependabot.yml`） | Semgrep（`github-actions-mutable-action-tag`） |
| ワークフローの `run` に、外から来た値（Pull Request のタイトルなど）を埋め込む | 外の人の Pull Request から、CI の権限でコマンドを動かされる | 外から来た値を `run` に直接書かない。`pull_request_target` で外のコードを取り出さない | Semgrep（`run-shell-injection`、`github-script-injection`、`pull-request-target-code-checkout`、`workflow-run-target-code-checkout`） |
| Cloudflare の API トークンなどの秘密の値をコミットする | 公開のリポジトリから、Cloudflare を操作される | 秘密の値は `wrangler secret put` で入れ、`wrangler.jsonc` に書かない（cloudflare.md 7章）。`.dev.vars` と `.env` はコミットしない（git-workflow.md「公開してよい情報」、`.gitignore`） | GitHub の Push protection（push の時点で止める）と Secret scanning（過去の履歴も調べる） |
| 日にちを UTC や動いている場所の時刻で決める | 消す日より前にしおりを消す。当日の判定がずれる | 日にちと時刻は `#lib/time.js` だけで扱い、SQL の今の時刻を使わない（code.md 2章） | ESLint（`getHours()`・`toISOString().slice()`・`new Date('…')`・SQL の `date('now')` などの禁止） |
