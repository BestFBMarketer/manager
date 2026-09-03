#!/bin/bash
# Pre-composites a SadTalker green-screen clip onto the channel's tv_frame.png
# background via ffmpeg (proven reliable - chromakey+overlay tested directly
# multiple times), producing a FLAT (non-alpha) video ready to play as-is in
# Remotion. This sidesteps Remotion's OffthreadVideo alpha-video compositing,
# which produced broken double-exposure artifacts on this machine across
# several codec/prop combinations (VP9 alpha silently dropped; ProRes4444 +
# transparent prop produced a warped red/green blend instead of clean keying) -
# see 2026-09-03 TierList sample-render investigation.
#
# Usage: composite_dummy_panel.sh in.mp4 tv_frame.png out.mp4
set -e
IN="$1"
FRAME="$2"
OUT="$3"

# FRAME artik tierboard_template.jpg'nin TV kismi + banner doldurulmus hali
# (tv_frame_banner.png, 572x335 kaynak) - dogrudan gercek sablonun ust
# parcasi, DummyPanel yuksekligi = 335/1024 = %32.71 (1920'de 628px).
# Banner-dolu alan (572x335 kaynakta x25-547,y35-335) 1080 genislige
# olceklenince (scale=1.8881): x47-1033,y66-632.
ffmpeg -y -loglevel error \
  -loop 1 -i "$FRAME" \
  -i "$IN" \
  -filter_complex "\
[0:v]scale=1080:628[bg]; \
[1:v]chromakey=0x057D0A:0.12:0.04,despill=type=green:mix=0.4:expand=0.0:brightness=0:green=-0.15,scale=-1:566[fg]; \
[bg][fg]overlay=x=257:y=66:format=auto:shortest=1[outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -pix_fmt yuv420p -c:a aac \
  "$OUT"
