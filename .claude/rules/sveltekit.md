# SvelteKit の約束事

SvelteKit と Svelte のコードを書くときの決まり。
1章は、守らないと動かない・壊れるもの。
2章から下は、段取りさんの作りとして決めたこと。
D1・リンク・回数の上限・自動削除・最新を取り直すとき・電波がないとき・wrangler の設定は [Cloudflare の約束事](cloudflare.md) に書く。

## 1. SvelteKit 3・Svelte 5 の書き方

段取りさんは SvelteKit 3 と Svelte 5（runes）だけで書く。
各表の「使わない」は前の版の書き方で、動かないかエラーになる。
覚えている書き方が「使わない」の列にあったら、「使う」の列に直してから書く。
表に無いことは、推測で書かずに [Svelte の公式ドキュメント](https://svelte.dev/docs) で確かめる。

### 設定とファイルの置き場所

| 使う | 使わない |
| --- | --- |
| `vite.config.ts` の `sveltekit({ … })` に書く（`kit` の中に書いていた設定も、ここに直接書く） | `svelte.config.js` |
| `src/params.ts` に `defineParams` で書く | `src/params/` に置く matcher |

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
| `Response.json(…)`・`new Response(…)` | `@sveltejs/kit` の `json(…)`・`text(…)` |
| `error(404, '見つかりません')`（2つ目は文字列だけ。ほかの値は3つ目に渡す） | `error(404, { message: … })` |

### Service Worker

| 使う | 使わない |
| --- | --- |
| `$app/manifest` の `immutable`・`assets`、`$app/env` の `version`、`$app/paths` の `resolve`、`$app/service-worker` の `self` | `$service-worker` の `build`・`files`・`version` |

### 使わない機能

- `remote functions` は試験的な機能なので使わない

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
