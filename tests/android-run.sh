#!/bin/bash
set -x
adb root || true; sleep 3
adb shell pm list packages | grep -i chrome
# Skip Chrome's first-run screens and allow the DevTools socket.
adb shell "echo '_ --disable-fre --no-default-browser-check --no-first-run --autoplay-policy=user-gesture-required' > /data/local/tmp/chrome-command-line"
adb shell am set-debug-app --persistent com.android.chrome || true
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "about:blank"
sleep 15
adb forward tcp:9222 localabstract:chrome_devtools_remote
curl -s http://127.0.0.1:9222/json/version
adb shell screenrecord --time-limit 170 /sdcard/run.mp4 &
node tests/android-chrome.mjs
mkdir -p out; adb pull /sdcard/run.mp4 "out/$(echo $DEVICE | tr -c 'A-Za-z0-9\n' '-')-video.mp4" || true
