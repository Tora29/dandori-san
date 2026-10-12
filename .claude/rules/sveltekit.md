# SvelteKit の約束事

SvelteKit と Svelte のコードを書くときの決まり。
1章は、守らないと動かない・壊れるもの。
2章から下は、段取りさんの作りとして決めたこと。
D1・リンク・回数の上限・自動削除・最新を取り直すとき・電波がないとき・wrangler の設定は [Cloudflare の約束事](cloudflare.md) に書く。

## 1. AI が出しやすい古い書き方

SvelteKit 3 は 2026-10-01 に出たばかりで、AI は SvelteKit 2 や Svelte 4 の書き方をよく混ぜる。
SvelteKit 2 の書き方は、3 ではもう動かない。
Svelte 4 の書き方は、runes を使う設定（下）にするとエラーになる。
迷ったら、[Svelte の公式ドキュメント](https://svelte.dev/docs) と [SvelteKit 3 への移行の案内](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) で確かめる。

### SvelteKit 2 → 3

| 古い（使わない） | 今 |
| --- | --- |
| `$lib/foo` | `#lib/foo.js`（拡張子まで書く。`package.json` の `imports` に `#lib` と `#lib/*` を書いておく） |
| `svelte.config.js` に書く設定 | `vite.config.ts` の `sveltekit({ … })` に書く（`kit` の中にあった設定は、一段上に出す） |
| `$app/stores` の `$page`・`$navigating` | `$app/state` の `page`・`navigating`（`$` を付けない） |
| `$app/environment` | `$app/env` |
| `$env/static/private` などの `$env/…` | `$app/env/private`・`$app/env/public` |
| `$app/paths` の `base`・`assets` | `resolve()`・`asset()`（引数の頭に `/` を付けない） |
| `invalidateAll()`・`goto` の `invalidateAll` | `refreshAll()`・`goto` の `refreshAll` |
| `json(…)`・`text(…)`（`@sveltejs/kit`） | `Response.json(…)`・`new Response(…)` |
| `error(404, { message: … })` | 2つ目は文字列だけ。ほかの値は3つ目に渡す |
| `src/params/` に置く matcher | `src/params.ts` に `defineParams` で書く |
| `data-sveltekit-*="off"` | `false` |
| `$service-worker` の `build`・`files`・`version` | `$app/manifest` の `immutable`・`assets`、`$app/env` の `version`、`$app/paths` の `resolve`、`$app/service-worker` の `self` |
| `event.platform.env.DB`（Cloudflare の環境） | `import { env } from "cloudflare:workers"` |

### Svelte 4 → 5

| 古い（使わない） | 今 |
| --- | --- |
| `export let name` | `let { name } = $props()` |
| `let count = 0`（それだけで画面が変わる変数） | `let count = $state(0)` |
| `$: double = count * 2` | `let double = $derived(count * 2)` |
| `$: { … }`（変わったら動く処理） | `$effect(() => { … })`。ただし、ほとんどは `$derived` で足りる。`$effect` の中で state を書き換えない |
| `on:click={…}` | `onclick={…}` |
| `on:click\|preventDefault` | `onclick` の中で `event.preventDefault()` を呼ぶ |
| `createEventDispatcher` | 関数を `$props` で受け取る |
| 子の `<slot />` | 子の `{@render children?.()}` |
| 子の `<slot name="x" />`・親の `<div slot="x">` | 子の `{@render x?.()}`・親の `{#snippet x()}` |

- すべての部品で runes の書き方にする。
  `vite.config.ts` の `sveltekit({ compilerOptions })` で、自分のファイルだけ runes にする。
  `runes: true` と書くと、`node_modules` の中の Svelte 4 の部品まで runes として読まれて壊れる

  ```ts
  runes: ({ filename }) =>
    filename.split(/[/\\]/).includes('node_modules') ? undefined : true
  ```

- `remote functions` は、3.0 の時点で試験的な機能なので使わない

## 2. JS が無くても動く形にする

- 書き込みは、フォーム（`<form method="POST">`）と form actions で作る。
  JS があるときは `use:enhance` で、ページを読み直さずに送る

- ボタンで画面を切り替えるだけの所は、リンク（`<a href>`）にする

- 紙（スマホの下から出る紙、パソコンの真ん中に出る紙）は `<dialog>` を使う

## 3. サーバーと画面を分ける

- D1 を読み書きする SQL は、`#lib/server/db/` の中にだけ書く。
  `+page.server.ts`・`+server.ts` などからは、そこにある関数を呼ぶ

- `cloudflare:workers` と `#lib/server/` の中のものは、サーバーで動くファイルからだけ import する。
  画面で動くファイルから import すると、SvelteKit がエラーにする（Vitest の中では、このエラーは出ない）

- 画面に渡すデータは、`load` で返す。
  画面の中で fetch してデータを取らない

- 最新を取り直すときは `refreshAll()` を使う。
  いつ取り直すかは [Cloudflare の約束事](cloudflare.md) の5章に従う。
  自分が書いたあとは、`use:enhance` が自動で取り直す

## 4. 安全

- 人が入れた文字を `{@html}` で出さない。
  そのまま文字として出す（`{value}`）

- 入力の長さと形は、サーバー側（form actions）でも確かめる。
  画面の入力欄の `maxlength` や `required` だけに頼らない（JS や画面を通らずに送れるため）

- ほかのサイトからのフォームの送信を防ぐ守り（CSRF）は、SvelteKit 3 では常に有効で、外せない。
  許す相手を足す `csrf.trustedOrigins` に、`*` などの広い相手を入れない

- 秘密の値を `$app/env/public` に置かない（画面に送られる）

## 5. テスト

| 対象 | テスト |
| --- | --- |
| `#lib/server/db/` | `@cloudflare/vitest-plugin` で、本物と同じ動きをする手元の D1 に対して、全部の関数をテストする（D1 はテストのファイルごとに分かれる） |
| 割り勘の計算など | Vitest の単体テスト |
| 画面 | Playwright で、7つの画面の主な操作。axe（`@axe-core/playwright`）でアクセシビリティ |
| マイグレーション | 前の形のデータに当てても壊れないか |

- `@cloudflare/vitest-pool-workers` は古い名前なので使わない（2026-08 に `@cloudflare/vitest-plugin` へ変わった）

- 作業を終えたと言う前に、`npm run check`（型と Svelte の確認）、`npm run lint`、`npm test` がすべて通ることを確かめる
