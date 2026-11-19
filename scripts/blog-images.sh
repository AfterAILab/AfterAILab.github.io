#!/usr/bin/env bash
# Blog の画像を公開できる形に整える。コミットの前に実行する。
#
#   scripts/blog-images.sh                 # src/content/blog/ の下の画像すべて
#   scripts/blog-images.sh path/to/a.jpg …  # 指定した画像だけ
#
# 各画像を
#   1. EXIF の向きどおりに回転し、
#   2. sRGB 以外の色(iPhone の Display P3 など)を sRGB に変換し、
#   3. 幅 1600px を超えていれば 1600px に縮小し、
#   4. EXIF・XMP・ICC などのメタデータ(撮影位置・機種・日時)をすべて消して
# 上書きする。HEIC は JPG に変換する(元の HEIC は消すので、記事の参照を .jpg に直す)。
# 整っている画像は何もしないので、何度実行してもよい。整っていない画像があるとビルドが失敗する
# (src/lib/blog-images.ts)。要: ImageMagick(brew install imagemagick)。
set -euo pipefail

cd "$(dirname "$0")/.."
command -v magick >/dev/null || { echo "magick が見つかりません(brew install imagemagick)" >&2; exit 1; }

MAX_WIDTH=1600
JPEG_QUALITY=85
SRGB="/System/Library/ColorSync/Profiles/sRGB Profile.icc"

files=()
if (( $# )); then
  files=("$@")
else
  while IFS= read -r -d '' f; do files+=("$f"); done < <(
    find src/content/blog -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.heic' \) -print0
  )
fi

for file in "${files[@]+"${files[@]}"}"; do
  ext=$(tr '[:upper:]' '[:lower:]' <<<"${file##*.}")
  out="$file"
  [[ "$ext" == heic ]] && out="${file%.*}.jpg"

  # (No "[0]" frame index: this ImageMagick fails to read files named so.)
  width=$(magick identify -format '%w' "$file")
  orientation=$(magick identify -format '%[orientation]' "$file")
  # Any EXIF, XMP, IPTC or ICC data left on the file (a warning, discarded, when there is none).
  profiles=$(magick identify -format '%[profiles]' "$file" 2>/dev/null || true)
  if [[ "$ext" != heic && $width -le $MAX_WIDTH && -z "$profiles" && ( "$orientation" == Undefined || "$orientation" == TopLeft ) ]]; then
    continue
  fi

  args=("$file" -auto-orient)
  # Convert colours to sRGB through the embedded profile before it is dropped.
  if magick identify -format '%[profile:icc]' "$file" 2>/dev/null | grep -q .; then
    args+=(-profile "$SRGB")
  fi
  args+=(-resize "${MAX_WIDTH}x>" -strip)
  case "$ext" in
    jpg | jpeg | heic) args+=(-quality "$JPEG_QUALITY" "jpg:$out.tmp") ;;
    png) args+=("png:$out.tmp") ;;
    webp) args+=(-quality "$JPEG_QUALITY" "webp:$out.tmp") ;;
    *) echo "skip     $file(対応していない形式)" >&2; continue ;;
  esac
  magick "${args[@]}"
  mv "$out.tmp" "$out"
  new_width=$(magick identify -format '%w' "$out")
  if [[ "$out" != "$file" ]]; then
    rm "$file"
    echo "heic→jpg $out(記事の参照を $(basename "$file") から $(basename "$out") に直してください)"
  else
    echo "cleaned  $out(幅 $width → $new_width、メタデータを除去)"
  fi
done
