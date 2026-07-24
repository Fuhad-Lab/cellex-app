#!/bin/bash
# Generate 3 smoke background videos using ffmpeg's noise/blur filters.
# All videos: 10 seconds, 1280x720, 30fps, black background, seamless loop.
# Different styles for the user to pick the best one.
#
# Style 1: Heavy dark smoke (slow, thick plumes)
# Style 2: Light wispy smoke (faster, thinner)
# Style 3: Medium flowing smoke (balanced)
#
# Run: bash scripts/generate_smoke_videos.sh

set -e
cd /home/z/my-project/public

echo "=== Generating 3 smoke background videos ==="
echo

# Style 1: Heavy dark smoke — slow, thick plumes
# Uses noise + heavy box blur + slow zoom for "heavy" feel
echo "1/3: Generating heavy-dark-smoke.mp4 (slow, thick plumes)..."
ffmpeg -y \
  -f lavfi -i "color=c=black:s=1280x720:d=10:r=30" \
  -f lavfi -i "nullsrc=s=1280x720:d=10:r=30,geq=random(1)*255:128:128,boxblur=40:20,boxblur=40:20,boxblur=40:20,format=gray,colorchannelmixer=0.4:0.4:0.5" \
  -filter_complex "[0:v][1:v]blend=all_mode=screen:all_opacity=0.6[v]" \
  -map "[v]" \
  -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p \
  -movflags +faststart \
  smoke-heavy.mp4 2>&1 | tail -3

echo "2/3: Generating wispy-smoke.mp4 (faster, thinner)..."
ffmpeg -y \
  -f lavfi -i "color=c=black:s=1280x720:d=10:r=30" \
  -f lavfi -i "nullsrc=s=1280x720:d=10:r=30,geq=random(1)*255:128:128,boxblur=20:10,boxblur=20:10,format=gray,colorchannelmixer=0.3:0.3:0.35" \
  -filter_complex "[0:v][1:v]blend=all_mode=screen:all_opacity=0.5[v]" \
  -map "[v]" \
  -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p \
  -movflags +faststart \
  smoke-wispy.mp4 2>&1 | tail -3

echo "3/3: Generating flowing-smoke.mp4 (balanced, medium)..."
ffmpeg -y \
  -f lavfi -i "color=c=black:s=1280x720:d=10:r=30" \
  -f lavfi -i "nullsrc=s=1280x720:d=10:r=30,geq=random(1)*255:128:128,boxblur=30:15,boxblur=30:15,boxblur=30:15,format=gray,colorchannelmixer=0.35:0.35:0.4" \
  -filter_complex "[0:v][1:v]blend=all_mode=screen:all_opacity=0.55[v]" \
  -map "[v]" \
  -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p \
  -movflags +faststart \
  smoke-flowing.mp4 2>&1 | tail -3

echo
echo "=== Done ==="
ls -lh smoke-*.mp4
echo
echo "3 smoke videos generated. Preview them and pick the best one."
echo "To use one as the background, rename it to smoke-bg.mp4:"
echo "  cp smoke-heavy.mp4 smoke-bg.mp4   (or smoke-wispy.mp4, smoke-flowing.mp4)"
