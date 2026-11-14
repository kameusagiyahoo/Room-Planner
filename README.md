# Room Planner — rewrite/v1

PC・iPhone対応の住宅間取り設計と3Dプレビュー。**GitHub Pages**で配信する静的Webアプリです。

## 開発

```sh
npm install
npm run dev
npm test
npm run build
```

GitHub Pagesへのデプロイは `main` へのマージ後、Actions `Deploy to GitHub Pages` を利用します。最初にRepository Settings → Pages → Sourceを **GitHub Actions** に設定してください。公開URLの予定は https://kameusagiyahoo.github.io/Room-Planner/ です（まだ新バージョンはmainに未反映）。

## 保存
- 作業内容はブラウザのIndexedDBへ自動一時保存
- JSONのエクスポート/インポートに対応
- GitHubへ保存するときは、本人が持つ**別の非公開データリポジトリ**とトークンを入力して明示保存
- Fine-grained PAT: 対象リポジトリ限定、Contents Read and Write。トークンはセッション中のメモリだけで扱い、ローカル保存・コミットしない
- データ構成: `projects/<id>/project.json`。専用リポジトリを新規作成する場合は非公開にすること
- 競合が起きた場合には保存が失敗し、ローカルのドラフトを維持する

仕様書: [docs/SPECIFICATION.md](docs/SPECIFICATION.md)、設計: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、進捗: [docs/ROADMAP.md](docs/ROADMAP.md)

現段階は操作検証用MVPであり、完成版のウォークスルー・衝突判定・豊富な家具等は未実装です。旧版はmainブランチに保持しています。
