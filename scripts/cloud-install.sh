#!/usr/bin/env bash
set -euo pipefail
cd /workspace/selman
export npm_config_cache=/workspace/.npm-cache
export electron_config_cache=/workspace/.electron-cache
# Paketleri kurduktan sonra Electron ikilisini mevcut proxy üzerinden doğrulayarak indir.
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
if [[ -n "${HTTPS_PROXY:-}" || -n "${HTTP_PROXY:-}" ]]; then
  export ELECTRON_GET_USE_PROXY=1
  export GLOBAL_AGENT_HTTPS_PROXY="${HTTPS_PROXY:-${HTTP_PROXY:-}}"
  export GLOBAL_AGENT_HTTP_PROXY="${HTTP_PROXY:-${HTTPS_PROXY:-}}"
fi
node node_modules/electron/install.js
npm run build
npm test
