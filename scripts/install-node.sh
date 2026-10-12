#!/usr/bin/env bash
# Checks for Node.js (Vite needs 20.19+ or 22.12+); if missing or too old, drops the
# official Node LTS tarball into ~/.local/node (no sudo, no package manager).
DEST="$HOME/.local/node"
[ -x "$DEST/bin/node" ] && export PATH="$DEST/bin:$PATH"

node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||a===22&&b>=12||a===20&&b>=19?0:1)"
}

if node_ok; then
  echo "Node already installed: $(node -v)"
  exit 0
fi
command -v node >/dev/null 2>&1 && echo "Node $(node -v) is too old (need 20.19+ or 22.12+)."

case "$(uname -s)" in
  Linux) OS=linux ;;
  Darwin) OS=darwin ;;
  *) echo "Unsupported OS $(uname -s). Install Node LTS from https://nodejs.org"; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  armv7l) ARCH=armv7l ;;
  *) echo "Unsupported CPU $(uname -m). Install Node LTS from https://nodejs.org"; exit 1 ;;
esac

if command -v curl >/dev/null 2>&1; then fetch() { curl -fsSL "$1"; }
else fetch() { wget -qO- "$1"; }
fi

VER="$(fetch https://nodejs.org/dist/index.json | grep -o '"version":"v[0-9.]*"[^}]*"lts":"' | head -1 | sed 's/^"version":"\(v[0-9.]*\)".*/\1/')"
if [ -z "$VER" ]; then
  echo "Could not look up Node LTS version. Check internet connection."
  exit 1
fi

echo "Installing Node $VER to $DEST..."
rm -rf "$DEST" && mkdir -p "$DEST" || exit 1
fetch "https://nodejs.org/dist/$VER/node-$VER-$OS-$ARCH.tar.gz" | tar -xz -C "$DEST" --strip-components=1 || {
  echo "Node download failed."
  exit 1
}

export PATH="$DEST/bin:$PATH"
echo "Node installed: $(node -v). To use it in other terminals add:"
echo "  export PATH=\"$DEST/bin:\$PATH\""
