# Room Planner — rewrite/v1

PC・iPhone対応の住宅間取り設計と3Dプレビュー。**GitHub Pages**で配信する静的Webアプリです。

## 開発

```sh
npm install
npm run dev
npm test
npm run build
```

GitHub Pagesへのデプロイは `main` または `rewrite/v1` への更新時に Actions `Deploy to GitHub Pages` を利用します。開発ブランチからも試験公開できるようにしています。最初にRepository Settings → Pages → Sourceを **GitHub Actions** に設定してください。公開URLの予定は https://kameusagiyahoo.github.io/Room-Planner/ です（まだ新バージョンはmainに未反映）。

## 保存
- 作業内容はブラウザのIndexedDBへ自動一時保存
- JSONのエクスポート/インポートに対応
- GitHubへ保存するときは、本人が持つ**別の非公開データリポジトリ**とトークンを入力して明示保存
- Fine-grained PAT: 対象リポジトリ限定、Contents Read and Write。トークンはセッション中のメモリだけで扱い、ローカル保存・コミットしない
- データ構成: `projects/<id>/project.json`。専用リポジトリを新規作成する場合は非公開にすること
- 競合が起きた場合には保存が失敗し、ローカルのドラフトを維持する

仕様書: [docs/SPECIFICATION.md](docs/SPECIFICATION.md)、設計: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、進捗: [docs/ROADMAP.md](docs/ROADMAP.md)

現段階は操作検証用MVPであり、完成版のウォークスルー・衝突判定・豊富な家具等は未実装です。旧版はmainブランチに保持しています。

## GitHub Pagesが表示されないとき
- このリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に変更する。
- **Actions** の `Deploy to GitHub Pages` が成功していることを確認する。CIの成功はPagesの公開成功を意味しない。
- ブランチ `rewrite/v1` は新アプリ、`main` には旧アプリが残る。Pagesが枝からの直接配信設定のままだと、旧アプリが表示される可能性がある。
- 静的ファイルの配置先は `dist/`、Viteの `base` は `/Room-Planner/`。
- GitHub Pagesのデプロイで権限やenvironment保護エラーが出る場合は `Settings → Environments → github-pages` のブランチ制限も確認する。
- 公開URL: https://kameusagiyahoo.github.io/Room-Planner/
- 実際の自宅設計データやGitHubアクセストークンをアプリ用の公開リポジトリへコミットしない。
