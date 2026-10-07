#!/usr/bin/env bash
# Weekly の号画像を配信用に整える。
#
#   scripts/weekly-images.sh            # 全号(生成済みの WebP は作り直さない)
#   scripts/weekly-images.sh vol57      # 指定した号だけ
#   scripts/weekly-images.sh --force [volN ...]   # WebP を作り直す(縮小済み JPG が元になるので、品質を上げたいときは原稿を置き直してから)
#
# public/img/weekly/{ja,en}/volN-{ja,en}.jpg(手描き原稿のスキャン)を
#   1. 幅 1600px を超えていれば 1600px に縮小して上書き(「大きな画像で開く」リンクと OG 画像に使う)
#   2. 幅 400 / 800 / 1600px の WebP(cwebp -q 82)を同じディレクトリに生成(<img srcset> で使う)
# する。WebP が揃っていて JPG が 1600px 以下の号は何もしないので、何度実行してもよい
# (mtime には依存しないので clone 直後でも同じ)。1600px より広い JPG = 置き直した原稿とみなし、WebP も作り直す。要: ImageMagick(magick)、libwebp(cwebp)。
set -euo pipefail

cd "$(dirname "$0")/.."
command -v magick >/dev/null || { echo "magick が見つかりません(brew install imagemagick)" >&2; exit 1; }
command -v cwebp  >/dev/null || { echo "cwebp が見つかりません(brew install webp)" >&2; exit 1; }

FORCE=0
slugs=()
for arg in "$@"; do
  if [[ "$arg" == "--force" ]]; then FORCE=1; else slugs+=("$arg"); fi
done

MAX_WIDTH=1600
WIDTHS=(400 800 1600)
QUALITY=82        # WebP
JPEG_QUALITY=80   # 縮小後の JPG(原稿のスキャンは q70 なのでこれで十分)

process() {
  local jpg="$1"
  local base="${jpg%.jpg}"
  local width
  width=$(magick identify -format '%w' "$jpg")
  # WebP は縮小前の原稿から直接作る(縮小 JPG を再圧縮しない)。既にあれば作り直さない(--force か、原稿が置き直されて 1600px より広いときを除く)。
  # 原稿が目標幅より狭いときは拡大せず原稿の幅のまま出す。一時ファイルに書いてから置くので、中断しても壊れた WebP は残らない。
  local made=0 w target
  for w in "${WIDTHS[@]}"; do
    [[ -f "$base-$w.webp" && $FORCE -eq 0 && $width -le $MAX_WIDTH ]] && continue
    target=$(( w < width ? w : width ))
    cwebp -quiet -q "$QUALITY" -resize "$target" 0 "$jpg" -o "$base-$w.webp.tmp"
    mv "$base-$w.webp.tmp" "$base-$w.webp"
    made=1
  done
  (( made )) && echo "webp     $base-{400,800,1600}.webp"
  if (( width > MAX_WIDTH )); then
    magick "$jpg" -auto-orient -resize "${MAX_WIDTH}x" -strip -quality "$JPEG_QUALITY" "jpg:$jpg.tmp"
    mv "$jpg.tmp" "$jpg"
    echo "resized  $jpg ($width -> $MAX_WIDTH)"
  fi
  return 0
}

if (( ${#slugs[@]} > 0 )); then
  for slug in "${slugs[@]}"; do
    found=0
    for jpg in public/img/weekly/ja/"$slug"-ja.jpg public/img/weekly/en/"$slug"-en.jpg; do
      [[ -f "$jpg" ]] || continue
      process "$jpg"; found=1
    done
    (( found )) || { echo "$slug の画像が見つかりません" >&2; exit 1; }
  done
else
  for jpg in public/img/weekly/ja/*.jpg public/img/weekly/en/*.jpg; do
    process "$jpg"
  done
fi
