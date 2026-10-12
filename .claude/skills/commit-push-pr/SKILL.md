---
name: commit-push-pr
description: 作業中の変更からブランチ作成・コミット・push・PR作成までを行い、ユーザーがマージして「完了」と伝えたら main に戻してローカルを片付ける。
disable-model-invocation: true
effort: low
---

# commit-push-pr

変更をコミットして PR を作成し、マージ後に後片付けをする。

ブランチ名・コミットメッセージ・PRのタイトルと本文・ラベルの書き方は `.claude/rules/git-workflow.md` に従う。このRepositoryは公開しており、マージ済みPRはActivityとしてポートフォリオに公開されるため、タイトルと本文の最初の段落は閲覧者向けに書く。

## フェーズ1：PR を作成する

### 1. 現状確認

```bash
git status
git branch --show-current
git diff --stat
git diff
```

- 変更がなければ、その旨を伝えて終了する

### 1-2. gh のアカウント確認

`gh` の操作中アカウントが、Repositoryの所有者と一致しているか確認する。

```bash
gh api user --jq .login
gh repo view --json owner --jq .owner.login
```

- 一致しない場合は、以降の手順に進まず、`! gh auth switch --user <所有者>` の実行をユーザーに依頼する
- 切り替え後に再度確認してから進む

### 2. 公開してよい内容か確認

差分に、`git-workflow.md` の「公開してよい情報」で書かない・コミットしないとしているものが含まれていないか確認する。含まれていればコミットせずユーザーに伝える。特に次のもの。

- `.env`・トークン・APIキー・署名の鍵などの秘密の値
- しおりのリンク（URL の中の鍵）
- 実際の旅行の中身（行き先、日程、集合場所、泊まる所、参加者の名前）
- `.claude/users/` のファイル（`.gitignore` 対象。強制追加しない）

### 2-2. 動作確認

このRepositoryにある確認のコマンドを実行する（`npm run lint`・`npm run check`・`npm test` など。そのときにあるもの）。まだコードが無く、確認のコマンドも無い場合は省略する。

- 1つでも失敗した場合は、コミットに進まず結果をユーザーに伝える
- 最後の変更の後に同じ会話の中で同じ確認を実行し、すべて通っている場合は省略してよい

### 3. ブランチを決める

- **main にいる場合**：差分から type と内容を判断してブランチ名を決め、作成する（形式は `git-workflow.md`）

  ```bash
  git switch -c <type>/<短い説明>
  ```

- **作業ブランチにいる場合**：そのブランチを使う

差分に無関係な変更が混ざっている場合（例：機能追加と別件の修正）は、PRを分けるかユーザーに確認する。

### 4. コミット

```bash
git add <対象ファイル>
git commit -m "<type>(<scope>): <内容>"
```

- `git add -A` / `git add .` を使わず、対象ファイルを指定する

### 5. push

```bash
git push -u origin <branch-name>
```

### 6. PR 作成

```bash
gh pr create --base main --head <branch-name> --title "<title>" --body "<body>"
```

- タイトル：`<type>(<scope>): <閲覧者が読んで分かる日本語>`（`: ` 以降がActivityの見出しになる）
- 本文：最初の段落に「何を変えて、使う人にとって何が良くなったか」を1〜2文。実装の詳細は見出し以降に書く
  - 「確認方法」には、その変更に固有の確認だけを書く。2-2 の確認の結果（チェックの表）は載せない
- ラベル：Activityとして載せない変更（type が feat / fix 等でも）には `activity:skip`、作品のTechと異なるTechを示したい場合は `tech:<id>` を `--label` で付ける。付けるかどうか迷う場合はユーザーに確認する
  - ラベルがまだ Repository に無い場合は、付ける前にユーザーに確認してから `gh label create` で作る

### 7. ユーザーに伝える

- PR の URL
- 動作確認の結果（実行したコマンドと結果。省略した場合はその理由）
- Activityとして公開される見出しと要約（タイトルの `: ` 以降と本文の最初の段落）
- 「マージしたら『完了』と伝えてください」

## フェーズ2：マージ後の後片付け（ユーザーが「完了」と伝えたとき）

### 1. マージを確認する

フェーズ1の「1-2. gh のアカウント確認」と同じ確認を先に行う。

```bash
gh pr view <branch-name> --json number,state,mergedAt,url
```

- `state` が `MERGED` でなければ、その旨を伝えて何もしない

### 2. main に戻して片付ける

```bash
git switch main
git pull --ff-only
git branch -D <branch-name>
git fetch --prune
```

- squash マージでは作業ブランチのコミットが main に含まれないため、`git branch -d` は失敗する。手順1でマージ済みを確認したうえで `-D` で削除する
- リモートの作業ブランチが残っている場合は削除する（GitHub の「Automatically delete head branches」が有効なら不要）

  ```bash
  git push origin --delete <branch-name>
  ```

### 3. 結果を伝える

main が最新になったこと、削除したブランチ名を伝える。

## 注意

- main へ直接 push しない
- `--force` / `--no-verify` を使わない
- `gh` にログインしていない場合は、`! gh auth login` の実行をユーザーに依頼する
- `gh` の操作中アカウントを自分で切り替えない（切り替えはユーザーが行う）
