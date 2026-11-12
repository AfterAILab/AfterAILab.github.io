#!/usr/bin/env bash
# AfterAI Weekly の音声版(ポッドキャスト)を配信用に変換する。
#
#   scripts/weekly-audio.sh vol58 ~/Downloads/新規録音.m4a
#
# iPhone のボイスメモなどで録った音声を、AAC 64kbps モノラルの m4a に変換して
# public/audio/weekly/volN.m4a に置く(10 分で 5MB 弱)。変換には macOS 標準の afconvert を使う。
# 置いたあとは src/content/weekly/issues.json の該当号に "audio": { "date": "YYYY-MM-DD" } を足す
# (ページのプレイヤーと /weekly/podcast.xml はビルド時にこのファイルから作られる)。
set -euo pipefail

cd "$(dirname "$0")/.."
command -v afconvert >/dev/null || { echo "afconvert が見つかりません(macOS で実行してください)" >&2; exit 1; }

if [[ $# -ne 2 || ! "$1" =~ ^vol[0-9]+$ ]]; then
  echo "使い方: scripts/weekly-audio.sh volN <録音ファイル>" >&2
  exit 1
fi
slug="$1"
src="$2"
[[ -f "$src" ]] || { echo "$src が見つかりません" >&2; exit 1; }

out="public/audio/weekly/$slug.m4a"
mkdir -p "$(dirname "$out")"
# 一時ファイルに書いてから置くので、中断しても壊れたファイルは残らない。
afconvert -f m4af -d aac@44100 -c 1 -b 64000 "$src" "$out.tmp"
mv "$out.tmp" "$out"

afinfo "$out" | grep -E "estimated duration|bit rate" | sed 's/^/  /'
echo "wrote    $out ($(du -h "$out" | cut -f1 | tr -d ' '))"
