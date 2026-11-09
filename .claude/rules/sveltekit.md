# SvelteKit の約束事

SvelteKit と Svelte のコードを書くときの決まり。
1章は、守らないと動かない・壊れるもの。
2章から下は、段取りさんの作りとして決めたこと。
D1・リンク・回数の上限・自動削除・最新を取り直すとき・電波がないとき・wrangler の設定は [Cloudflare の約束事](cloudflare.md)、名前・時刻・置き場所は [コードの約束事](code.md) に書く。

## 1. SvelteKit 3・Svelte 5 の書き方

段取りさんは SvelteKit 3 と Svelte 5（runes）だけで書く。
各表の「使わない」は前の版の書き方で、動かないかエラーになる。
覚えている書き方が「使わない」の列にあったら、「使う」の列に直してから書く。
表に無いことは、推測で書かずに [Svelte の公式ドキュメント](https://svelte.dev/docs) で確かめる。

### 設定とファイルの置き場所

| 使う | 使わない |
| --- | --- |
| `vite.config.ts` の `sveltekit({ … })` に書く（`kit` の中に書いていた設定も、ここに直接書く） | `svelte.config.js` |
| `src/params.ts` に `defineParams`（`@sveltejs/kit/params` から import する）で書く | `src/params/` に置く matcher |

- すべての部品を runes で書く。
  `vite.config.ts` の `sveltekit({ compilerOptions })` で、自分のファイルだけ runes にする。
  `runes: true` と書くと、`node_modules` の中の古い部品まで runes として読まれて壊れる

  ```ts
  runes: ({ filename }) =>
    filename.split(/[/\\]/).includes('node_modules') ? undefined : true
  ```

### import

| 使う | 使わない |
| --- | --- |
| `#lib/foo.js`（拡張子まで書く。`package.json` の `imports` に `#lib` と `#lib/*` を書いておく） | `$lib/foo` |
| `$app/state` の `page`・`navigating`（`$` を付けない） | `$app/stores` の `$page`・`$navigating` |
| `$app/env` | `$app/environment` |
| `$app/env/private`・`$app/env/public` | `$env/static/private` などの `$env/…` |
| `import { env } from "cloudflare:workers"` | `event.platform.env.DB` |

### 部品の書き方

| 使う | 使わない |
| --- | --- |
| `let { name } = $props()` | `export let name` |
| `let count = $state(0)` | `let count = 0`（それだけで画面が変わる変数） |
| `let double = $derived(count * 2)` | `$: double = count * 2` |
| `$effect(() => { … })` | `$: { … }`（変わったら動く処理） |
| `onclick={…}` | `on:click={…}` |
| `onclick` の中で `event.preventDefault()` を呼ぶ | `on:click\|preventDefault` |
| 関数を `$props` で受け取る | `createEventDispatcher` |
| 子の `{@render children?.()}` | 子の `<slot />` |
| 子の `{@render x?.()}`・親の `{#snippet x()}` | 子の `<slot name="x" />`・親の `<div slot="x">` |

- `$effect` はほとんど要らない。
  ほかの値から決まる値は `$derived` で書く。
  `$effect` の中で state を書き換えない

### ページの移動と取り直し

| 使う | 使わない |
| --- | --- |
| `$app/paths` の `resolve()`・`asset()`（引数の頭に `/` を付けない） | `$app/paths` の `base`・`assets` |
| `refreshAll()`・`goto` の `refreshAll` | `invalidateAll()`・`goto` の `invalidateAll` |
| `data-sveltekit-*` に `false` を書く | `data-sveltekit-*="off"` |

### 応答とエラー

| 使う | 使わない |
| --- | --- |
| `Response.json(…)`・`new Response(…)` | `@sveltejs/kit` の `json(…)`・`text(…)`（非推奨） |
| `error(404, '見つかりません')`（2つ目は文字列だけ。ほかの値は3つ目に渡す） | `error(404, { message: … })` |

### Service Worker

| 使う | 使わない |
| --- | --- |
| `$app/manifest` の `immutable`・`assets`、`$app/env` の `version`、`$app/paths` の `resolve`、`$app/service-worker` の `self` | `$service-worker` の `build`・`files`・`version` |

### 使わない機能

- `remote functions` は試験的な機能なので使わない

## 2. しおりのページとしおりの外のページ

しおりの鍵はリンクの `#` の後ろにあり、暗号を端末の中で解く（[Cloudflare の約束事](cloudflare.md) 2章）。
そのため、しおりのページ（`/s`）は JS が無いと動かない。

- しおりのページで JS が無いときは、`<noscript>` で、JS を有効にすれば見られることを書いたページを出す

- しおりの外のページ（はじめに・しおりを作る前の説明・プライバシー・利用規約など）は、JS が無くても読めるようにする

- ボタンで画面を切り替えるだけの所は、リンク（`<a href>`）にする

- 紙（スマホの下から出る紙、パソコンの真ん中に出る紙）は `<dialog>` を使う

## 3. サーバーと画面を分ける

- `cloudflare:workers` と `#lib/server/` の中のものは、サーバーで動くファイルからだけ import する。
  画面で動くファイルから import すると、SvelteKit がエラーにする（Vitest の中では、このエラーは出ない）

- しおりのデータは、端末で鍵から札を作ってから、`+server.ts` に取りに行く（JSON）。
  札は `Authorization` のヘッダーで送り、URL に入れない

- しおりの書き込みは、端末で中身を確かめて暗号にしてから（`#lib/trip-seal.ts`）、`+server.ts` に JSON で送る。
  form actions は使わない（サーバーは中身を読めず、暗号にできないため）

- サーバーで作る画面（SSR）に、しおりの中身を入れない。
  `/s` は `ssr = false` にする

- `#` の鍵は、`load` の中では読めない（`url.hash` を使うと SvelteKit がエラーにする）。
  部品の中で、`$app/state` の `page.url.hash` を `$derived` で読む。
  別のリンクを貼られて `#` が変わったときも、読み直す

- しおりの外のページのデータは、`load` で返す

- しおりを取り直すときは、しおりのページの取り直しの関数を使う（`refreshAll()` は、`load` で返すデータにしか効かないため）。
  いつ取り直すかは [Cloudflare の約束事](cloudflare.md) の5章に従う。
  自分が書いたあとも、この関数で取り直す

## 4. 安全

- 人が入れた文字を `{@html}` で出さない。
  そのまま文字として出す（`{value}`）

- 中身の決まり（文字数・見えない文字・日にち）は、端末で確かめる。
  サーバーは中身を読めないので、送られた記録の形だけを確かめる（[Cloudflare の約束事](cloudflare.md) 2章）。
  画面の入力欄の `maxlength` や `required` だけに頼らず、`#lib/trip-rules.ts` の zod で確かめる

- しおりの `+server.ts` は、`Content-Type: application/json` だけを受ける。
  本文は `unknown` で受け取り、zod で確かめてから使う。
  しおりは札からだけ決め、本文の `trip_id` などは読まない。
  返す値とエラーに、札を入れない

- ほかのサイトからの送信を防ぐ SvelteKit の守り（CSRF）は、フォームの形の Content-Type（と Content-Type が無いもの）の POST・PUT・PATCH・DELETE でしか Origin を確かめない。
  JSON の書き込みはこの守りの外なので、`Origin` が自分のドメインかを `+server.ts` で確かめる。
  しおりを作る POST は札が無いので、特にこの確かめが要る。
  `csrf.trustedOrigins` に `'*'` を入れると守りが外れるので、入れない。
  開発のサーバーでは効かないので、確かめるときは build したもので見る

- 秘密の値を `$app/env/public` に置かない（画面に送られる）

## 5. テスト

| 対象 | テスト |
| --- | --- |
| `#lib/server/db/` | `@cloudflare/vitest-plugin` で、本物と同じ動きをする手元の D1 に対して、全部の関数をテストする（Vitest の project の `db`）。同時に直したときの版の番号の比べ方も、ここで確かめる |
| 計算と決まり（[使い方の約束事](features.md) の当日の判定・いまと次は・翌日またぎ・変わった所の印・割り勘の精算と端数、[Cloudflare の約束事](cloudflare.md) 4章の消す日、[コードの約束事](code.md) 5章の入力の決まり） | Vitest の単体テスト（project の `unit`）。決めたことの場合分けを、1つずつテストにする |
| 暗号の形 | Node の暗号の関数で別に作った暗号文を読めるかで固定する（[Cloudflare の約束事](cloudflare.md) 2章） |
| 画面 | Playwright で、7つの画面の主な操作を、Chromium と WebKit（iPhone）の両方で流す。axe（`@axe-core/playwright`）でアクセシビリティ |
| マイグレーション | 前の形のデータに当てても壊れないか |

- テストの期待値は、ルールや決めたことから書く。
  実装を動かして出た値を、そのまま期待値に貼らない（まちがった実装でも通ってしまうため）

- テストを通すためだけに、期待値を書き換えない。
  期待値を変えるときは、なぜ変わるのかを人に伝える

- 不具合を直すときは、その不具合が起きるテストも足す

- 時刻の計算には、決まった `now` を渡してテストする（[コードの約束事](code.md) 2章）

- 単体のテストは、対象のファイルの隣に `*.test.ts` で置く。
  画面のテストは `e2e/*.e2e.ts` に置く

- D1 のテストは、`#lib/server/db/test-support.ts` の `clearTables` で、テストごとに表を空にする。
  D1 はテストのファイルごとにしか分かれないため

- `@cloudflare/vitest-pool-workers` は古い名前なので使わない（2026-08 に `@cloudflare/vitest-plugin` へ変わった）

- 作業を終えたと言う前に、`npm run check`（型と Svelte の確認）、`npm run lint`、`npm test` がすべて通ることを確かめる
