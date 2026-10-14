#!/bin/sh
# 生成 AI で作った効果音（WAV）を、ゲームで使う形（MP3・モノラル・96kbps）に変える。
#   sh tools/sfx.sh <元の WAV> <名前（attack など。sfx_ は付けない）>
# 置き場所は src/audio/sfx/<名前>.mp3。置くだけで AudioManager が使う（ないものは合成音のまま）。ffmpeg が必要。
set -e
ffmpeg -hide_banner -loglevel error -y -i "$1" -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k "src/audio/sfx/$2.mp3"
ls -l "src/audio/sfx/$2.mp3"
