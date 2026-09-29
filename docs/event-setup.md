# Event setup: phone camera

The booth can use the AFAQ Booth Camera app (Android phone) instead of a webcam. The phone serves video and photos on port 8080.

## Connection options

1. **Phone hotspot (recommended).** Turn on the phone's hotspot and connect the booth PC to it. The phone address is stable. Open the app and copy the address it shows (for example `http://192.168.43.1:8080`). The PC loses normal internet unless it has a second connection. The booth itself works offline.
2. **Booth PC hotspot.** Turn on the PC's mobile hotspot and connect the phone. Use the address the app shows.
3. **Venue Wi-Fi.** Fragile at events. Many venue networks block devices from talking to each other. Use only as a last resort.
4. **USB cable.** Enable USB debugging on the phone, plug it in. In the booth settings choose Connection: USB cable and press Test connection. The booth server runs `adb forward` for you and redoes it after a replug. `adb` must be installed on the booth PC. This also charges the phone. `scripts\phone-usb.bat` does the same by hand.

### USB commands

```
adb devices
adb forward tcp:8080 tcp:8080
```

`adb forward` makes the phone's port 8080 appear as `localhost:8080` on the PC. (`adb reverse` goes the other way and is not what we need.) `scripts\phone-usb.bat` runs these. If `npm run fake-phone` is running, stop it first because it also uses port 8080.

## Booth settings

1. Start the phone app first and leave it open in front with the screen on.
2. Start the booth (`npm run dev`).
3. Tap the gear, enter the operator PIN (default `1234`).
4. Set Camera source to Phone app, type the address, press Test connection.
5. Close the settings. The start screen shows the live picture.

## Testing without a phone

`npm run fake-phone` serves sample pictures from `scripts/fake-phone/` (or `cloud/data`) on port 8080.
