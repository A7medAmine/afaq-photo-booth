@echo off
rem Forwards the phone's camera server to this PC over USB so the booth can use http://localhost:8080
adb start-server
adb devices
adb forward tcp:8080 tcp:8080
if errorlevel 1 (
  echo Could not forward. Check the USB cable and that USB debugging is on.
  exit /b 1
)
echo Done. In the booth settings use http://localhost:8080
