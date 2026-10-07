# afterai.dev

AfterAI株式会社の公開サイト。[Astro](https://astro.build) で静的生成し、GitHub Pages(GitHub Actions)で配信しています。

## 開発

```bash
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # dist/ に出力
pnpm preview   # dist/ をローカル配信
pnpm check     # 型チェック
```

## 構成

| パス | 内容 |
|---|---|
| `src/pages/index.astro` | トップ(アプリ 3 枚、AfterAI VPP、Weekly 最新号、お問い合わせ) |
| `src/pages/apps.astro` + `src/data/apps.ts` | アプリ一覧。アプリの説明文・URL・アイコンは `apps.ts` を編集 |
| `src/pages/vpp.astro` | AfterAI VPP の紹介と実機 PoC 結果(`#poc`)。プレイヤーは `public/vpp-demo/` |
| `src/pages/weekly/` + `src/content/weekly/` | AfterAI Weekly のアーカイブ |
| `src/pages/about.astro` / `src/pages/works/` | 会社概要、これまでの活動(Flaps、Maker Faire、遊戯王ライフカウンター) |
| `src/layouts/Base.astro` / `src/styles/global.css` | 共通レイアウト、ライト/ダークのデザイントークン |
| `astro.config.mjs` | 旧 URL(`/ja/*`、`/vpp/demo/` など)からのリダイレクト |
| `_admin/` | 印刷用など運用メモ(サイトには含まれない) |

## Weekly に新しい号を追加する

1. 画像を `public/img/weekly/ja/volN-ja.jpg` に置く(無ければ `public/img/weekly/en/volN-en.jpg` が使われる)。
2. `src/content/weekly/issues.json` に `{ "id": "volN", "number": N, "slug": "volN" }` を追加する。
3. 文字起こしがあれば `src/content/weekly/transcriptions/volN.md` を置く(任意)。

## デプロイ

`main` に push すると `.github/workflows/deploy.yml` がビルドして GitHub Pages に配信します。
リポジトリ設定の Pages の Source は **GitHub Actions** にしておく必要があります。
