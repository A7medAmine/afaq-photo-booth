#!/usr/bin/env bash
# Forwards the phone's camera server to this PC over USB so the booth can use http://localhost:8080
adb start-server
adb devices
if ! adb forward tcp:8080 tcp:8080; then
  echo "Could not forward. Check the USB cable and that USB debugging is on."
  exit 1
fi
echo "Done. In the booth settings use http://localhost:8080"
