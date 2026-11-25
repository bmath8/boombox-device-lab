#!/bin/bash
# Encrypt ./out and add it to the results branch (a separate clone, so the test checkout is never touched).
# GitHub refuses files over 100 MB, so screenshots are shrunk to JPEG on macOS, videos are cut to 720p, and the archive is split.
set -e
TAG="$1"
mkdir -p out
if command -v sips >/dev/null; then
  find out -name '*.png' -print0 | while IFS= read -r -d '' f; do sips -s format jpeg -s formatOptions 70 -Z 1400 "$f" --out "${f%.png}.jpg" >/dev/null 2>&1 && rm -f "$f"; done
fi
if command -v ffmpeg >/dev/null; then
  find out -name '*.mp4' -print0 | while IFS= read -r -d '' f; do ffmpeg -loglevel error -y -i "$f" -vf scale=-2:720 -r 10 -c:v libx264 -crf 32 -an "${f%.mp4}.s.mp4" && mv "${f%.mp4}.s.mp4" "$f"; done
fi
du -sh out
tar czf /tmp/r.tgz out
openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:LAB_KEY -in /tmp/r.tgz -out "/tmp/$TAG.tgz.enc"
mkdir -p /tmp/parts && (cd /tmp/parts && split -b 90m "/tmp/$TAG.tgz.enc" "$TAG.tgz.enc.part-")
URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}"
rm -rf /tmp/res; git clone -q --depth 1 --branch results "$URL" /tmp/res
cd /tmp/res; git config user.name lab; git config user.email lab@users.noreply.github.com
mkdir -p runs; cp /tmp/parts/* runs/; git add runs; git commit -qm "results $TAG"
for i in 1 2 3 4 5; do git pull -q --rebase origin results && git push -q origin HEAD:results && exit 0; sleep $((i*7)); done
exit 1
