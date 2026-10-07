#!/usr/bin/env bash
# /apps/ /vpp/ /about/ の OG 画像(1200×630 PNG)を既存素材から合成して public/img/og/ に書き出す。
#
#   scripts/og-images.sh
#
# 素材を差し替えたら再実行する。要: ImageMagick(magick)、macOS のヒラギノ角ゴシック。
set -euo pipefail
cd "$(dirname "$0")/.."
command -v magick >/dev/null || { echo "magick が見つかりません(brew install imagemagick)" >&2; exit 1; }

OUT=public/img/og
W=1200; H=630
# global.css のライトテーマのトークンを sRGB に直した値
BG='#EDF7FC'; TEXT='#001932'; PRIMARY='#006AD7'; MUTED='#34698C'; SURFACE2='#D9F1FD'
# ファイル名は NFD で保存されているので glob で拾う
BOLD=$(ls /System/Library/Fonts/*W7.ttc 2>/dev/null | head -1 || true)
REGULAR=$(ls /System/Library/Fonts/*"ゴシック W4.ttc" 2>/dev/null | head -1 || true)
[[ -f "$BOLD" && -f "$REGULAR" ]] || { echo "ヒラギノ角ゴシック W4/W7 が見つかりません" >&2; exit 1; }
mkdir -p "$OUT"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# 角を丸める: rounded <in> <width> <radius> <out>
rounded() {
  local w h
  magick "$1" -resize "$2x" "$tmp/_r.png"
  w=$(magick identify -format '%w' "$tmp/_r.png"); h=$(magick identify -format '%h' "$tmp/_r.png")
  magick "$tmp/_r.png" -alpha set \
    \( -size "${w}x${h}" xc:none -draw "roundrectangle 0,0 $((w-1)),$((h-1)) $3,$3" \) \
    -compose DstIn -composite "$4"
}

# ---- /apps/: 3 つのアプリアイコンを並べる --------------------------------------
# CapySteps のアイコンは背景が透明なので、他の 2 つと揃うようタイルに載せる
magick public/img/apps/capysteps.png -background "$SURFACE2" -alpha remove -alpha off "$tmp/capysteps-tile.png"
rounded public/img/apps/waripon.png 220 48 "$tmp/waripon.png"
rounded public/img/apps/kondate.png 220 48 "$tmp/kondate.png"
rounded "$tmp/capysteps-tile.png" 220 48 "$tmp/capysteps.png"
magick -size ${W}x${H} "xc:$BG" \
  "$tmp/waripon.png" -geometry +230+130 -composite \
  "$tmp/kondate.png" -geometry +490+130 -composite \
  "$tmp/capysteps.png" -geometry +750+130 -composite \
  -font "$BOLD" -pointsize 52 -fill "$TEXT" -gravity North -annotate +0+410 '暮らしの中で使うアプリ' \
  -font "$REGULAR" -pointsize 28 -fill "$MUTED" -annotate +0+488 'わりぽん ・ kondate ・ CapySteps' \
  -font "$BOLD" -pointsize 24 -fill "$PRIMARY" -gravity SouthEast -annotate +56+40 'afterai.dev' \
  -alpha off -depth 8 "$OUT/apps.png"

# ---- /vpp/: 管理コンソール画面をブランド色の背景に載せる ------------------------------
rounded public/vpp-demo/console/overview.png 1000 16 "$tmp/console.png"
magick -size ${W}x${H} "gradient:$PRIMARY-#0B3F8F" \
  -font "$BOLD" -pointsize 54 -fill white -gravity NorthWest -annotate +100+72 'AfterAI VPP' \
  -font "$REGULAR" -pointsize 28 -fill '#D6E6FA' -annotate +104+146 '蓄電池を、VPPリソースに変える。' \
  \( "$tmp/console.png" \( +clone -background black -shadow 40x24+0+12 \) +swap -background none -layers merge +repage \) \
  -gravity North -geometry +0+230 -composite \
  -font "$BOLD" -pointsize 24 -fill white -gravity NorthEast -annotate +100+84 'afterai.dev' \
  -alpha off -depth 8 "$OUT/vpp.png"

# ---- /about/: 代表写真と社名 --------------------------------------------------
magick public/img/people/yuji.jpeg -resize 300x300 -alpha set \
  \( -size 300x300 xc:none -draw 'circle 150,150 150,0' \) -compose DstIn -composite "$tmp/photo.png"
magick -size ${W}x${H} "xc:$BG" \
  "$tmp/photo.png" -geometry +120+165 -composite \
  -font "$BOLD" -pointsize 60 -fill "$TEXT" -gravity NorthWest -annotate +490+218 'AfterAI株式会社' \
  -font "$REGULAR" -pointsize 28 -fill "$MUTED" -annotate +494+318 '暮らしの中で使うアプリと、電力市場向けの VPP を' \
  -annotate +494+362 '自社開発するソフトウェア会社です。' \
  -font "$BOLD" -pointsize 24 -fill "$PRIMARY" -gravity SouthEast -annotate +56+40 'afterai.dev' \
  -alpha off -depth 8 "$OUT/about.png"

for f in apps vpp about; do printf '%-6s %s %sKB\n' "$f" "$(magick identify -format '%wx%h' "$OUT/$f.png")" "$(du -k "$OUT/$f.png" | cut -f1)"; done
