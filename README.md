# afterai.dev

AfterAI株式会社の公開サイト。[Astro](https://astro.build) で静的生成し、GitHub Pages(GitHub Actions)で配信しています。

## 開発

```bash
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # dist/ に出力
pnpm preview   # dist/ をローカル配信
pnpm check     # 型チェック
pnpm test:renderer  # Blog の Markdown 変換のテスト(macOS では JavaScriptCore と V8 で出力が一致するかも確かめる)
pnpm test:blog-images  # Kakiaji が投稿で作り直した画像の見本(scripts/fixtures/kakiaji-images/)がビルドの画像の検査を通るか(Node 23.6 以上)
```

## 構成

| パス | 内容 |
|---|---|
| `src/pages/index.astro` | トップ(アプリ 3 枚、Weekly 最新号、お問い合わせ) |
| `src/pages/apps.astro` + `src/data/apps.ts` | アプリ一覧。アプリの説明文・URL・アイコンは `apps.ts` を編集 |
| `src/pages/vpp.astro` | AfterAI VPP の紹介と実機 PoC 結果(`#poc`)。プレイヤーは `public/vpp-demo/` |
| `src/pages/blog/` + `src/content/blog/` + `src/lib/blog.ts` | Blog(トップメニュー)。記事を新しい順に並べた一覧と、記事ページ(← → で前後の記事へ) |
| `src/lib/blog-markdown/` + `src/styles/article.css` | Blog 記事の Markdown → HTML 変換と本文のスタイル。執筆アプリ Kakiaji のプレビューも同じものを使う(下の「Kakiaji との共有」) |
| `src/pages/weekly/` + `src/content/weekly/` | AfterAI Weekly のアーカイブ |
| `src/pages/about.astro` / `src/pages/works/` | 会社概要、これまでの活動(Flaps、Maker Faire、遊戯王ライフカウンター) |
| `src/layouts/Base.astro` / `src/styles/global.css` | 共通レイアウト、ライト/ダークのデザイントークン |
| `astro.config.mjs` | 旧 URL(`/ja/*`、`/vpp/demo/` など)からのリダイレクト |
| `_admin/` | 印刷用など運用メモ(サイトには含まれない) |
| `src/lib/podcast.ts` + `src/pages/weekly/podcast.xml.ts` | 音声付録のポッドキャスト「AfterAI Weekly」の番組情報と RSS(`/weekly/podcast.xml`)。カバー画像は `public/img/podcast/cover.jpg` |
| `scripts/` | 画像と音声の前処理。`weekly-images.sh`(Weekly 画像の縮小・WebP 生成)、`weekly-audio.sh`(音声付録を m4a に変換)、`og-images.sh`(/apps/ /vpp/ /about/ の OG 画像を合成)、`blog-images.sh`(Blog の画像の縮小・メタデータ除去) |

## Blog に記事を書く

1. `src/content/blog/` に `YYYY-MM-DD-slug.md`(例: `2026-11-18-paging.md`)を作る(エディタは何でもよい)。日付が公開日、ファイル名(`.md` を除く)が記事の id と URL(`/blog/2026-11-18-paging/`)になる。ただし id はファイル名を GitHub の見出しのアンカーと同じ規則で変換したもの: 英字は小文字になり、空白は `-` になり、`.` やたいていの記号(全角も)は消える(`2026-11-18-v1.2 Release.md` → `/blog/2026-11-18-v12-release/`)。迷わないよう、`slug` の部分は `a-z`・`0-9`・`-` だけで書く。
2. 本文は `# タイトル` の行から書き始める。その見出しがページのタイトルになる。最初の段落の冒頭が検索結果・リンクプレビュー用の説明文になる。
3. 名前が `_` で始まるファイルは下書きとして公開されない。公開するときにファイル名から `_` を外す。
4. push すると Blog の一覧の先頭に出る。記事ページの ← → で前後の記事へ移る。

front matter(`title` / `date` / `description`)を書けば、上の自動の値より優先される。front matter に `slug` は書かない(書くと変換されずにそのまま id になり、日付で始まらない slug では、front matter に `date` も無ければビルドが失敗する)。

Kakiaji から投稿した記事は、GitHub の API で `main` に直接コミットされる(設計: `../kakiaji/docs/blog-publishing.md`)。手元の clone で作業する前に `git pull` する。

### 画像

1. 記事ごとのフォルダ `src/content/blog/<記事のファイル名から .md を除いたもの>/` に置き、`![説明](./2026-11-18-paging/写真.jpg)` のように参照する。名前に空白があるときは `![説明](<./2026-11-18-paging/写真 1.jpg>)` と書く。
2. コミットの前に `scripts/blog-images.sh` を実行する(要 `brew install imagemagick`)。向きを正し、色を sRGB に変換し、幅 1600px まで縮小し、EXIF などのメタデータ(撮影位置・機種・日時)をすべて消して上書きする。HEIC は JPG に変換する(参照は自分で `.jpg` に直す)。
3. このリポジトリは公開されているので、整っていない画像(幅 1600px 超、メタデータ付き、HEIC)が `src/content/blog/` の下に 1 枚でもあると、記事から参照していなくてもビルドが失敗する(`src/lib/blog-images.ts`)。
   この規則(最大幅、JPG の品質、使える拡張子、禁じるメタデータ)は `src/lib/blog-rules.json` に書いてあり、ビルドの検査と Kakiaji はそのすべてを、`blog-images.sh` は最大幅・品質・探す拡張子を使う(メタデータは規則にかかわらずすべて消す。GIF と AVIF は直さずに知らせる)。拡張子を変えたら、`src/pages/blog/[id].astro` の画像の glob と、`blog-images.sh` の形式ごとの処理(`case`)も直す。
4. ページでは 400 / 800 / 1600px の WebP(`srcset`)として配信される。参照先が見つからなければビルドが失敗する。

書き方の決まり: 改行 1 つでは段落を分けない(日本語どうしの行は空白なしでつながる)。`"…"` `--` `...` は “…” – … になる。本文に書いた HTML は出力されない。コードブロックは Shiki で色が付く。

### Kakiaji との共有

執筆アプリ Kakiaji(`../kakiaji`)のプレビューは、このサイトの変換処理(`src/lib/blog-markdown/`)とスタイル(`src/styles/global.css` + `article.css`)をそのまま JavaScriptCore で動かし、公開ページと同じ見た目にしている。Blog への投稿でも、同じパーサーで画像の参照を一覧にして書き換え(`src/lib/blog-markdown/publish.ts`)、画像の規則(`src/lib/blog-rules.json`)で検査する。これらを変えたら:

1. `pnpm test:renderer` で、期待どおりの出力になること、JavaScriptCore と V8(Node)で出力が一致することを確かめる。
2. Kakiaji のリポジトリで `make sync-renderer` を実行し(`pnpm build:renderer` が `Resources/Renderer/` に JS・CSS・規則の JSON を書き出す)、Kakiaji 側でコミットする。
3. 画像の規則(`blog-rules.json`)や検査(`blog-images.ts`)を変えたら、同期のあとで Kakiaji をビルドし直して見本を作り直し(`../kakiaji/.build/debug/Kakiaji --blog-samples scripts/fixtures/kakiaji-images`)、`pnpm test:blog-images` を通す(幅の規則を変えたら、テストの期待する大きさも直す)。

変換処理は Node 専用・DOM 専用の API を使わないこと(JavaScriptCore で動かなくなる)。

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
