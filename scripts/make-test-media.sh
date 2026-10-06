#!/usr/bin/env sh
# Gera ficheiros de teste em test-media/ (precisa de ffmpeg no sistema).
set -e
cd "$(dirname "$0")/.."
mkdir -p test-media && cd test-media
ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest clipA.mp4
ffmpeg -loglevel error -y -f lavfi -i smptebars=size=1280x720:rate=30 -t 5 -c:v libx264 -pix_fmt yuv420p clipB.mp4
ffmpeg -loglevel error -y -f lavfi -i sine=frequency=220:sample_rate=48000 -t 10 musica.mp3
ffmpeg -loglevel error -y -f lavfi -i color=c=orange:size=400x400 -frames:v 1 logo.png
echo "Ficheiros de teste criados em test-media/"
