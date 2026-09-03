#!/bin/bash
# Converts a green-screen SadTalker mp4 to an alpha-channel video for Remotion
# OffthreadVideo compositing. Usage: chromakey_to_webm.sh in.mp4 out.mov
#
# Uses ProRes 4444 (.mov), NOT VP9/WebM: libvpx-vp9's alpha encoding silently
# drops the alpha channel on this machine even with -auto-alt-ref 0 (verified:
# ffprobe still reported plain yuv420p, and compositing onto a red test
# background showed solid opaque green - no transparency at all). ProRes 4444
# is a well-established, reliably-supported alpha codec in ffmpeg and Remotion
# reads it fine via OffthreadVideo.
set -e
IN="$1"
OUT="$2"
ffmpeg -y -loglevel error -i "$IN" \
  -vf "chromakey=0x057D0A:0.20:0.10,despill=type=green:mix=0.6:expand=0.1:brightness=0:green=-0.2,format=yuva444p10le" \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le \
  -c:a aac \
  "$OUT"
