#!/usr/bin/env bash
# One-click start: ensure adb, forward phone camera over USB, install deps, start booth + cloud.
cd "$(dirname "$0")" || exit 1

bash scripts/install-adb.sh || exit 1
# fresh zip install may not be on PATH yet
command -v adb >/dev/null 2>&1 || export PATH="$PATH:$HOME/Android/platform-tools"

bash scripts/phone-usb.sh || echo "Continuing without phone forward..."

[ -d node_modules ] || { echo "Installing booth deps..."; npm install || exit 1; }
[ -d cloud/node_modules ] || { echo "Installing cloud deps..."; npm --prefix cloud install || exit 1; }

npm run dev
