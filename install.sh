#!/usr/bin/env bash
#
# Arkveil CLI installer — installs the `arkveil` command without npm.
#
# It downloads the published, self-contained bundle from the npm registry over
# HTTPS (the registry is just a file host — no npm CLI required), then drops a
# small launcher on your PATH.
#
# Requirements: Node.js >= 20, plus `curl` (or `wget`) and `tar` — standard on
# macOS and Linux. keytar/OS-keychain storage is not set up by this installer;
# the CLI transparently falls back to encrypted-at-rest file storage.
#
# Quick install:
#   curl -fsSL https://raw.githubusercontent.com/arkveil-abac/arkveil-cli/main/install.sh | bash
#
# Uninstall:
#   curl -fsSL https://raw.githubusercontent.com/arkveil-abac/arkveil-cli/main/install.sh | bash -s -- --uninstall
#
# Environment overrides:
#   ARKVEIL_VERSION       install a specific version           (default: latest)
#   ARKVEIL_INSTALL_DIR   library install directory            (default: $HOME/.arkveil)
#   ARKVEIL_BIN_DIR       directory for the `arkveil` launcher (default: auto-detected)
#   ARKVEIL_REGISTRY      npm registry base URL                (default: https://registry.npmjs.org)

set -euo pipefail

PACKAGE_NAME="@arkveil/cli"
COMMAND_NAME="arkveil"
MIN_NODE_MAJOR=20
REGISTRY="${ARKVEIL_REGISTRY:-https://registry.npmjs.org}"
INSTALL_DIR="${ARKVEIL_INSTALL_DIR:-$HOME/.arkveil}"
LIB_DIR="$INSTALL_DIR/lib"

# ---------- output helpers ----------
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); RESET=$(printf '\033[0m')
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi
info() { printf '%s %s\n' "${BOLD}==>${RESET}" "$*"; }
warn() { printf '%s %s\n' "${YELLOW}warning:${RESET}" "$*" >&2; }
die()  { printf '%s %s\n' "${RED}error:${RESET}" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---------- download abstraction (curl or wget) ----------
fetch() {  # fetch <url> -> stdout
  if have curl; then curl -fsSL "$1"
  elif have wget; then wget -qO- "$1"
  else die "need 'curl' or 'wget' to download files"; fi
}
download() {  # download <url> <dest>
  if have curl; then curl -fsSL "$1" -o "$2"
  elif have wget; then wget -qO "$2" "$1"
  else die "need 'curl' or 'wget' to download files"; fi
}

# ---------- uninstall ----------
uninstall() {
  info "Uninstalling ${COMMAND_NAME}..."
  local removed=0 d launcher
  for d in "${ARKVEIL_BIN_DIR:-}" "$HOME/.local/bin" "/usr/local/bin" "$INSTALL_DIR/bin"; do
    [ -n "$d" ] || continue
    launcher="$d/$COMMAND_NAME"
    if [ -f "$launcher" ] && grep -q "$INSTALL_DIR" "$launcher" 2>/dev/null; then
      rm -f "$launcher" && { info "removed $launcher"; removed=1; }
    fi
  done
  if [ -d "$INSTALL_DIR" ]; then rm -rf "$INSTALL_DIR" && info "removed $INSTALL_DIR"; removed=1; fi
  [ "$removed" -eq 1 ] && info "${GREEN}Done.${RESET}" || warn "nothing to uninstall."
  exit 0
}
[ "${1:-}" = "--uninstall" ] && uninstall

# ---------- prerequisites ----------
have tar || die "'tar' is required but was not found on PATH."
if ! have node; then
  die "Node.js >= ${MIN_NODE_MAJOR} is required, but 'node' was not found on PATH.
       Install it from https://nodejs.org (or your package manager) and re-run."
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  die "Node.js >= ${MIN_NODE_MAJOR} is required, but found $(node --version)."
fi

# ---------- resolve version + tarball URL ----------
if [ -n "${ARKVEIL_VERSION:-}" ]; then
  meta_url="$REGISTRY/$PACKAGE_NAME/$ARKVEIL_VERSION"
  info "Resolving ${PACKAGE_NAME}@${ARKVEIL_VERSION}..."
else
  meta_url="$REGISTRY/$PACKAGE_NAME/latest"
  info "Resolving ${PACKAGE_NAME} (latest)..."
fi

meta=$(fetch "$meta_url") || die "could not reach registry at ${REGISTRY}"
# Extract fields without requiring jq.
tarball=$(printf '%s' "$meta" | grep -o '"tarball":"[^"]*"' | head -1 | sed 's/^"tarball":"//;s/"$//')
VERSION=$(printf '%s' "$meta" | grep -o '"version":"[^"]*"' | head -1 | sed 's/^"version":"//;s/"$//')
[ -n "$tarball" ] || die "no published tarball found for ${PACKAGE_NAME} ${ARKVEIL_VERSION:-latest}.
       Has it been published to ${REGISTRY} yet?"

# ---------- download + extract ----------
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
info "Downloading ${PACKAGE_NAME}@${VERSION}..."
download "$tarball" "$tmp/pkg.tgz"
mkdir -p "$tmp/extract"
tar -xzf "$tmp/pkg.tgz" -C "$tmp/extract"   # npm tarballs unpack under ./package
[ -f "$tmp/extract/package/dist/index.js" ] || die "downloaded archive is missing dist/index.js"

# ---------- install into LIB_DIR ----------
info "Installing to ${LIB_DIR}..."
rm -rf "$LIB_DIR"
mkdir -p "$LIB_DIR"
cp -R "$tmp/extract/package/." "$LIB_DIR/"

# ---------- pick a bin directory + write launcher ----------
pick_bin_dir() {
  if [ -n "${ARKVEIL_BIN_DIR:-}" ]; then printf '%s' "$ARKVEIL_BIN_DIR"; return; fi
  if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then printf '%s' "/usr/local/bin"; return; fi
  printf '%s' "$HOME/.local/bin"
}
BIN_DIR=$(pick_bin_dir)
mkdir -p "$BIN_DIR" || die "could not create bin directory ${BIN_DIR}"
launcher="$BIN_DIR/$COMMAND_NAME"
cat > "$launcher" <<EOF
#!/bin/sh
# Launcher for the Arkveil CLI (installed by install.sh). Do not edit.
exec node "$LIB_DIR/dist/index.js" "\$@"
EOF
chmod +x "$launcher"

# ---------- verify ----------
if ! "$launcher" --version >/dev/null 2>&1; then
  die "installed but the launcher failed to run. Try: node \"$LIB_DIR/dist/index.js\" --version"
fi
info "${GREEN}Installed ${COMMAND_NAME} ${VERSION}${RESET} → ${launcher}"

# ---------- PATH hint ----------
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    warn "${BIN_DIR} is not on your PATH. Add this line to your shell profile (~/.zshrc or ~/.bashrc):"
    printf '\n    export PATH="%s:$PATH"\n' "$BIN_DIR"
    ;;
esac

cat <<EOF

${BOLD}Get started:${RESET}
    ${COMMAND_NAME} auth login
    ${COMMAND_NAME} --help

${DIM}Credentials are stored in a local config file (OS keychain support requires the
optional native 'keytar' module, which this npm-free installer does not build).${RESET}
EOF
