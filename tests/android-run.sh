#!/bin/bash
set -x
adb root || true; sleep 3
adb shell pm list packages | grep -i chrome
# Skip Chrome's first-run screens and allow the DevTools socket.
adb shell "echo '_ --disable-fre --no-default-browser-check --no-first-run --autoplay-policy=user-gesture-required' > /data/local/tmp/chrome-command-line"
adb shell am set-debug-app --persistent com.android.chrome || true
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "about:blank"
sleep 15
for i in $(seq 1 12); do
  SOCK=$(adb shell cat /proc/net/unix | grep -o '@chrome_devtools_remote[^ ]*' | head -1 | tr -d '@\r')
  [ -n "$SOCK" ] && adb forward tcp:9222 localabstract:$SOCK && curl -sf http://127.0.0.1:9222/json/version && break
  echo "waiting for Chrome's DevTools socket ($i)"; adb shell input keyevent 66; adb shell am start -a android.intent.action.VIEW -d "https://example.com" com.android.chrome >/dev/null; sleep 10
done
adb exec-out screencap -p > /tmp/chrome-start.png; mkdir -p out; cp /tmp/chrome-start.png out/ || true
adb shell screenrecord --time-limit 170 /sdcard/run.mp4 &
node tests/android-chrome.mjs
mkdir -p out; adb pull /sdcard/run.mp4 "out/$(echo $DEVICE | tr -c 'A-Za-z0-9\n' '-')-video.mp4" || true
