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
| `src/pages/index.astro` | トップ(アプリ 3 枚、Weekly 最新号、お問い合わせ) |
| `src/pages/apps.astro` + `src/data/apps.ts` | アプリ一覧。アプリの説明文・URL・アイコンは `apps.ts` を編集 |
| `src/pages/vpp.astro` | AfterAI VPP の紹介と実機 PoC 結果(`#poc`)。プレイヤーは `public/vpp-demo/` |
| `src/pages/weekly/` + `src/content/weekly/` | AfterAI Weekly のアーカイブ |
| `src/pages/about.astro` / `src/pages/works/` | 会社概要、これまでの活動(Flaps、Maker Faire、遊戯王ライフカウンター) |
| `src/layouts/Base.astro` / `src/styles/global.css` | 共通レイアウト、ライト/ダークのデザイントークン |
| `astro.config.mjs` | 旧 URL(`/ja/*`、`/vpp/demo/` など)からのリダイレクト |
| `_admin/` | 印刷用など運用メモ(サイトには含まれない) |
| `src/lib/podcast.ts` + `src/pages/weekly/podcast.xml.ts` | 音声付録のポッドキャスト「AfterAI Weekly」の番組情報と RSS(`/weekly/podcast.xml`)。カバー画像は `public/img/podcast/cover.jpg` |
| `scripts/` | 画像と音声の前処理。`weekly-images.sh`(Weekly 画像の縮小・WebP 生成)、`weekly-audio.sh`(音声付録を m4a に変換)、`og-images.sh`(/apps/ /vpp/ /about/ の OG 画像を合成) |

## Weekly に新しい号を追加する

1. 画像を `public/img/weekly/ja/volN-ja.jpg` に置く(無ければ `public/img/weekly/en/volN-en.jpg` が使われる)。
2. `scripts/weekly-images.sh volN` を実行する(要 `brew install imagemagick webp`)。JPG を幅 1600px に縮小し、一覧・号ページが使う WebP(400/800/1600px)を隣に生成する。生成物も一緒にコミットする。
3. `src/content/weekly/issues.json` に `{ "id": "volN", "number": N, "slug": "volN", "date": "YYYY-MM-DD" }` を追加する(`date` は紙面右上に手書きした発行日。一覧のカードに出る)。
4. 文字起こしがあれば `src/content/weekly/transcriptions/volN.md` を置く(任意)。

## 号に音声(ポッドキャスト「AfterAI Weekly」)を付ける

1. iPhone のボイスメモなどで録音し、Mac に送る。
2. `scripts/weekly-audio.sh volN <録音ファイル>` を実行する。AAC 64kbps モノラルに変換して `public/audio/weekly/volN.m4a` に置く(macOS 標準の afconvert を使う)。
3. `src/content/weekly/issues.json` の該当号に `"audio": { "date": "YYYY-MM-DD" }` を足す。`"title"`(既定は「AfterAI Weekly Vol.N」)と `"description"`(番組ノート)も書ける。
4. push すると `/weekly/podcast.xml` にエピソードが増える。Spotify(https://open.spotify.com/show/0vCoTOQ87A6zBSC5mrIwbA)はこの RSS から取り込む(数時間かかることがある)。
5. Spotify にエピソードが出たら「共有 → リンクをコピー」で URL を取り、`open.spotify.com/episode/` の後ろの ID を `"audio"` に `"spotify": "…"` として足して push する。ここで初めて号ページに Spotify のプレイヤーが出て、一覧にヘッドホンの印が付く。Substack の号にも同じ URL を貼れば埋め込まれる。

音声ファイルと `audio` の片方だけがあるとビルドが失敗する。公開したエピソードを別の号に付け替えないこと(エピソードの ID が号から作られるので、アプリで新しいエピソードとして出し直される)。

## デプロイ

`main` に push すると `.github/workflows/deploy.yml` がビルドして GitHub Pages に配信します。
リポジトリ設定の Pages の Source は **GitHub Actions** にしておく必要があります。
