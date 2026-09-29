#!/usr/bin/env bash
# Checks for adb; installs Android platform-tools if missing (Linux + macOS).
if command -v adb >/dev/null 2>&1; then
  echo "adb already installed:"
  adb version | head -1
  exit 0
fi

echo "adb not found. Installing..."
if [ "$(uname)" = "Darwin" ]; then
  if command -v brew >/dev/null 2>&1; then
    brew install --cask android-platform-tools || exit 1
  else
    echo "Install Homebrew first (https://brew.sh) or download platform-tools manually."
    exit 1
  fi
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y adb || exit 1
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y android-tools || exit 1
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -S --noconfirm android-tools || exit 1
else
  # Fallback: Google's zip into ~/Android/platform-tools
  DEST="$HOME/Android"
  mkdir -p "$DEST" || exit 1
  ZIP="$(mktemp)"
  curl -fL https://dl.google.com/android/repository/platform-tools-latest-linux.zip -o "$ZIP" || exit 1
  unzip -oq "$ZIP" -d "$DEST" || exit 1
  rm -f "$ZIP"
  echo "adb installed at $DEST/platform-tools. Add it to PATH:"
  echo "  export PATH=\"\$PATH:$DEST/platform-tools\""
fi

adb version | head -1
