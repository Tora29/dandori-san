# コードの約束事

どの画面・機能でも共通する、コードの書き方の決まり。
言葉とコードの名前の対応、時刻と日にちの扱い、置き場所と書き方を決める。
SvelteKit と Svelte の書き方は [SvelteKit の約束事](sveltekit.md)、D1 は [Cloudflare の約束事](cloudflare.md)、画面ごとの動きは [使い方の約束事](features.md) に書く。

## 1. 言葉とコードの名前

画面の言葉と、コードの名前（テーブル・列・型・変数）を、この表でそろえる。
表に無い言葉を名前にするときは、先に表に足してから書く。

| 画面の言葉 | コードの名前 | メモ |
| --- | --- | --- |
| しおり | `trip` | 1つの旅行。リンク1つにつき1つ |
| 旅の名前 | `trip.title` | |
| 日にち（はじめ・終わり） | `trip.startDate`・`trip.endDate` | |
| 消す日 | `trip.deleteOn` | |
| 予定を最後に直した時刻 | `trip.plansUpdatedAt` | 予定を足す・直す・消したときと、しおりの日にちを直したときだけ変える。持ち物・立て替え・チェック・名前では変えない（当日の確かめで、予定と関係のない書き込みのたびに「ほかの人が予定を直しました」と出さないため） |
| 鍵 | `tripKey` | リンクの中の乱数。D1 には置かない |
| 鍵のハッシュ | `keyHash` | D1 には、こちらを置く |
| 一緒に行く人 | `member` | 名前を入れた人と、「足す」で足した人 |
| 呼び名 | `member.name` | |
| 足した人 | `member.addedBy` | 足した人の `member` の ID。自分で名前を入れた人は空 |
| 幹事 | `trip.organizerId` | しおりを作った人。`member` の1人 |
| 予定 | `plan` | 予定の1行。予定のページを指すときは `planPage` のように `page` を付ける |
| やること・場所・メモ | `plan.title`・`plan.place`・`plan.memo` | |
| 日・時刻・終わりの時刻 | `plan.date`・`plan.startTime`・`plan.endTime` | 時刻は空でもよい |
| 並び順 | `plan.position` | 同じ時刻の予定と、時刻が空の予定の順。`order` は SQL の言葉なので使わない |
| 持ち物 | `item` | 持ち物のページは `items` |
| みんなで使うもの・それぞれ持っていくもの | `item.kind` の `shared`・`personal` | |
| 持っていく人 | `item.bringerId` | みんなで使うものだけ |
| 持ち物のチェック | `itemCheck` | 人ごとに持つ |
| 割り勘 | `split` | 割り勘のページ |
| 立て替え | `expense` | |
| 立て替えの内容・金額 | `expense.title`・`expense.amount` | 金額は円の整数 |
| 立て替えた人 | `expense.payerId` | |
| 割る人 | `expense.sharerIds` | D1 では `expense_sharers` の表 |
| 1人あたり | `perPerson` | |
| 精算 | `settlement` | だれがだれにいくら払うか |
| 払った | `settlement.paid`・`settlement.paidBy` | `paidBy` は押した人 |
| 直した記録 | `edit` | |
| 直した人・直す前と後の値・直した時刻 | `edit.editorName`・`edit.before`・`edit.after`・`edit.editedAt` | 呼び名は、直したときのものを残す |
| 版の番号 | `plan.version` など | 直すものごとに持つ。同時に直したかを比べる |
| 変わった所の印 | `changed` | 色のトークンと同じ名前 |
| いまの予定・次の予定 | `currentPlan`・`nextPlan` | |
| 今の時刻 | `now` | 2章。いまの予定と混ぜない |
| 旅行の前・当日・旅行のあと | `phase` の `before`・`during`・`after` | 境目は [使い方の約束事](features.md) 1章 |
| 旅行の日にちの外になった予定 | `plansOutsideTrip` | |
| みんなに知らせる・送る文 | `notify`・`notifyText` | |
| 元に戻す・上書きする | `undo`・`overwrite` | |
| 最新を取り直す | `refresh` | |
| いつの状態か | `savedAt` | 電波がないときに出す |
| 回数の上限 | `rateLimit` | |
| 自動削除 | `cleanup` | |

- 画面の名前は、[Git・Pull Request ルール](git-workflow.md) の scope（`start`・`create`・`join`・`plan`・`items`・`split`）にそろえる

- D1 のテーブルと列は `snake_case`、テーブルは複数形にする（`trips`・`plans`・`trip_id`・`key_hash`）。
  TypeScript では `camelCase` にする。
  変換は `#lib/server/db/` の中だけで行う

- ほかの表を指す列は `〜_id`（TypeScript では `〜Id`）にする。
  2つの表をつなぐ表は、2つの名前を並べる（`expense_sharers`）

- 名前の終わりで、値の形を分ける。
  `〜On`・`〜Date` は日にち、`〜Time` は時計の時刻、`〜At` は記録の時刻（2章）

- 真偽値は、D1 では `INTEGER` の 0 と 1 にする。
  空の値は `NULL` にし、空の文字を入れない

- 画面の言葉は、[デザインの約束事](design-principles.md) 8章に従う。
  コードの名前を、そのまま画面に出さない

## 2. 時刻と日にち

段取りさんは、日本時間で動く。
今は、国内の旅行だけを考える。

海外の旅行では、「当日」「いま」「あと何分」が、現地の時刻とずれる。
分かったうえで、今は直さない。
予定の時刻は時計の文字で持つので、あとでしおりごとのタイムゾーンを足しても、データを移さなくてよい。

Workers は UTC で動き、端末のタイムゾーンもまちまちなので、何もしないとずれる。

- 予定の日にちは `YYYY-MM-DD`、時刻は `HH:MM` の文字で持つ（D1 では `TEXT`）。
  日本時間の時計の文字として扱い、`Date` に直して保存しない

- 入力を受け取ったら、サーバーで形をそろえて確かめる。
  `<input type="time">` は `HH:MM:SS` を送ることがあるので、`HH:MM` にそろえる。
  日にちは、本当にある日か（`2026-02-30` は通さない）と、はじめが終わりより後でないかを確かめる

- 記録の時刻（直した時刻、予定を最後に直した時刻など）は、UTC のミリ秒で持つ（D1 では `INTEGER`）。
  画面に出すときに日本時間に直す

- 時計を読むのは、`#lib/time.js` の `now()` だけにする。
  今の日にちも、記録の時刻も、ここから取る

- 時刻の計算は、`now` を引数で受け取る関数にする。
  `now()` を呼ぶのは、一番外側（`load`・form action・画面の一番上の部品）だけにする。
  テストでは、決まった `now` を渡して確かめる

- 本番に、時刻を差し替える入口（URL の引数など）を作らない。
  画面のテストは、日本時間の今日から日にちを作ったしおりで行う

- 日本時間の日にちと時刻を作るときは、`Intl.DateTimeFormat` に `timeZone: 'Asia/Tokyo'` と `hourCycle: 'h23'` を渡す。
  日本にはサマータイムが無いので、日本時間の日時から記録の時刻へは、`Date.UTC(年, 月 - 1, 日, 時, 分)` から9時間を引いて直せる

- `#lib/time.js` の外では、次の書き方を使わない。
  どれも、UTC か、動いている場所のタイムゾーンに左右される
  - `getHours()`・`getDate()` などの、日にちや時刻を取り出す書き方
  - `toISOString().slice(0, 10)` で今日を取る（日本時間の朝9時より前は、前の日になる）
  - `new Date('2026-03-10')`（UTC として読む）と `new Date('2026-03-10T09:00')`（動いている場所の時刻として読む）
  - `setMonth()` などで日にちを足す（11月30日に3か月を足すと、3月2日になる）
  - SQL の `date('now')`・`CURRENT_TIMESTAMP`・`unixepoch()`（UTC で、テストで差し替えられない）。
    日本時間の今日や今の時刻は、引数としてバインドして渡す

- 「いま」「次は」「あと何分」は、画面で今の時刻から計算し直す。
  開いたとき、`visibilitychange` と `pageshow` のとき、1分ごとに計算する。
  サーバーで作った値をそのまま残すと、電波がないときに保存した画面や、前のページに戻ったときに、古いままになる。
  文字を変えるだけなので、[デザインの約束事](design-principles.md) 4章の動きには当たらない

## 3. 置き場所

| 置くもの | 場所 |
| --- | --- |
| 時計を読む関数と、時刻の計算 | `#lib/time.js` |
| 画面とサーバーの両方で使う計算（割り勘など） | `#lib/` の直下か、名前を付けたフォルダ |
| サーバーだけで動くもの（鍵のハッシュなど） | `#lib/server/` |
| 画面の部品 | `#lib/components/` |
| トークンと全体の CSS | `#lib/styles/` |

- D1 の SQL とマイグレーションは [Cloudflare の約束事](cloudflare.md) 1章、テストは [SvelteKit の約束事](sveltekit.md) 5章に置き場所を書く

- ファイル名は、部品は `PascalCase.svelte`、runes を使うものは `kebab-case.svelte.ts`、それ以外は `kebab-case.ts` にする。
  SvelteKit やツールが決めた名前（`+page.svelte`・`hooks.server.ts`・`app.d.ts`・`vite.config.ts` など）は、そのままにする

## 4. 書き方

- 名前は英語で、1章の表に従う。
  コメント・テストの名前・エラーの文は日本語で書く

- `any` を使わない。
  外から来た値（フォームの入力・D1 の行）は、`unknown` として受け取り、確かめてから型を付ける

- 部品の props などで、省略できるものは `?: T | undefined` と書く。
  tsconfig の `exactOptionalPropertyTypes` で、`?: T` には `undefined` を渡せないため

- コメントには、コードを読んでも分からない「なぜ」だけを短く書く。
  何をしているかは、名前とコードで分かるようにする

- 守らないといけない値（「3:1 以上」など）や、名前では分からない目的を書くときは、出どころのルールの章を添える（「accessibility.md 6章」）

- 次のコメントは書かない。
  見つけたら消す
  - ファイルや設定の頭の、何のファイルかの説明（「PR と main への push で、型・lint・テストを確かめる」）
  - 名前やコードをそのまま言い直すもの（`.sr-only` の上の「読み上げにだけ伝える」）
  - 「ここに書く」のような置き場所の案内や、コメントにしただけの使わないコード

- 書いてよいもの：
  - 長い設定の区切りの見出し（`# ---- 秘密の値 ----`）
  - 型の注釈（`/** @type … */`）
  - トークンの CSS のコントラスト比（[アクセシビリティの約束事](accessibility.md) 1章で、書くと決めているもの）
