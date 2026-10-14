#!/usr/bin/env bash
# Re-render frame ranges and splice them into build/the-internet-court.mp4.
# Usage: tools/patch_ranges.sh 840:1012 1389:1611 2169:2400
set -euo pipefail
cd "$(dirname "$0")/.."
B=build
inputs=(-i "$B/the-internet-court.mp4")
filters=""; parts=""; prev=0; n=1
for r in "$@"; do
  a=${r%:*}; b=${r#*:}
  FRAMES=$r node tools/render.mjs 3 30 | tail -1
  for w in 0 1 2; do mv "$B/seg$w.mp4" "$B/patch_${a}_$w.mp4"; done
  filters+="[0:v]trim=start_frame=$prev:end_frame=$a,setpts=PTS-STARTPTS[k$n];"; parts+="[k$n]"
  for w in 0 1 2; do inputs+=(-i "$B/patch_${a}_$w.mp4"); m=$(( ${#inputs[@]} / 2 - 1 )); parts+="[$m:v]"; done
  prev=$b; n=$((n+1))
done
filters+="[0:v]trim=start_frame=$prev,setpts=PTS-STARTPTS[k$n];"; parts+="[k$n]"
cnt=$(echo "$parts" | grep -o '\[' | wc -l)
ffmpeg -v error -y "${inputs[@]}" -i audio/mix.wav -filter_complex "${filters}${parts}concat=n=$cnt:v=1:a=0,fps=30[v]" \
  -map "[v]" -map "$(( ${#inputs[@]} / 2 )):a" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart "$B/patched.mp4"
mv "$B/patched.mp4" "$B/the-internet-court.mp4"; rm -f "$B"/patch_*.mp4
