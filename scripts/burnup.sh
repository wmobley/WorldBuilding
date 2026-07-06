#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.worldbuilding-dev"
LOG_DIR="$STATE_DIR/logs"
VITE_PID_FILE="$STATE_DIR/vite.pid"
VITE_LOG="$LOG_DIR/vite.log"

HOST="${WORLD_BUILDING_DEV_HOST:-127.0.0.1}"
PORT="${WORLD_BUILDING_DEV_PORT:-5173}"
SKIP_INSTALL="${WORLD_BUILDING_SKIP_INSTALL:-0}"
SKIP_SUPABASE="${WORLD_BUILDING_SKIP_SUPABASE:-0}"
FORCE_LOCAL_ENV="${WORLD_BUILDING_FORCE_LOCAL_ENV:-0}"

usage() {
  cat <<USAGE
Usage: npm run burnup [-- options]

Starts the WorldBuilding local development stack:
  - npm dependencies, when node_modules is missing
  - local Supabase, unless skipped
  - Vite dev server on http://${HOST}:${PORT}

Options:
  --no-install       Do not run npm install when node_modules is missing.
  --no-supabase     Do not start local Supabase or sync local Supabase env.
  --force-local-env Rewrite .env to point at the local Supabase instance.
  -h, --help        Show this help.

Environment:
  WORLD_BUILDING_DEV_HOST=127.0.0.1
  WORLD_BUILDING_DEV_PORT=5173
  WORLD_BUILDING_SKIP_INSTALL=1
  WORLD_BUILDING_SKIP_SUPABASE=1
  WORLD_BUILDING_FORCE_LOCAL_ENV=1
USAGE
}

while (($#)); do
  case "$1" in
    --no-install)
      SKIP_INSTALL=1
      ;;
    --no-supabase)
      SKIP_SUPABASE=1
      ;;
    --force-local-env)
      FORCE_LOCAL_ENV=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf '[burnup] Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

say() {
  printf '[burnup] %s\n' "$*"
}

fail() {
  printf '[burnup] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

is_pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

upsert_env() {
  local key="$1"
  local value="$2"
  local env_file="$ROOT_DIR/.env"
  local tmp_file

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/worldbuilding-env.XXXXXX")"

  if [[ -f "$env_file" ]] && grep -q "^${key}=" "$env_file"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { prefix = key "=" }
      index($0, prefix) == 1 { print key "=" value; next }
      { print }
    ' "$env_file" > "$tmp_file"
  else
    if [[ -f "$env_file" ]]; then
      cp "$env_file" "$tmp_file"
      printf '%s=%s\n' "$key" "$value" >> "$tmp_file"
    else
      printf '%s=%s\n' "$key" "$value" > "$tmp_file"
    fi
  fi

  mv "$tmp_file" "$env_file"
}

env_value() {
  local key="$1"
  local env_file="$ROOT_DIR/.env"

  [[ -f "$env_file" ]] || return 0
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

sync_local_supabase_env() {
  local status api_url anon_key current_url

  status="$(supabase status -o env 2>/dev/null || true)"
  api_url="$(printf '%s\n' "$status" | awk -F= '$1 == "API_URL" { sub(/^[^=]*=/, ""); print; exit }')"
  anon_key="$(printf '%s\n' "$status" | awk -F= '$1 == "ANON_KEY" { sub(/^[^=]*=/, ""); print; exit }')"

  [[ -n "$api_url" ]] || api_url="http://127.0.0.1:54321"
  [[ -n "$anon_key" ]] || {
    say "Could not read the local Supabase ANON_KEY; leaving .env unchanged."
    return 0
  }

  if [[ ! -f "$ROOT_DIR/.env" && -f "$ROOT_DIR/.env.example" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    say "Created .env from .env.example."
  fi

  current_url="$(env_value "VITE_SUPABASE_URL")"
  if [[ -n "$current_url" && "$current_url" != http://127.0.0.1:* && "$current_url" != http://localhost:* && "$FORCE_LOCAL_ENV" != "1" ]]; then
    say ".env points at $current_url; leaving Supabase env unchanged. Use --force-local-env to switch to local Supabase."
    return 0
  fi

  upsert_env "VITE_SUPABASE_URL" "$api_url"
  upsert_env "VITE_SUPABASE_ANON_KEY" "$anon_key"
  upsert_env "VITE_SUPABASE_REDIRECT_URL" "http://${HOST}:${PORT}"
  upsert_env "VITE_ENABLE_DEV_LOGIN" "true"
  say "Synced .env with local Supabase credentials."
}

start_vite() {
  local existing_pid vite_pid

  mkdir -p "$LOG_DIR"

  if [[ -f "$VITE_PID_FILE" ]]; then
    existing_pid="$(cat "$VITE_PID_FILE")"
    if is_pid_alive "$existing_pid"; then
      say "Vite is already running with PID $existing_pid."
      say "App: http://${HOST}:${PORT}"
      say "Log: $VITE_LOG"
      return 0
    fi
    rm -f "$VITE_PID_FILE"
  fi

  if [[ ! -x "$ROOT_DIR/node_modules/.bin/vite" ]]; then
    fail "Vite is not installed. Run npm install or rerun without --no-install."
  fi

  say "Starting Vite on http://${HOST}:${PORT}."
  nohup "$ROOT_DIR/node_modules/.bin/vite" --host "$HOST" --port "$PORT" --strictPort > "$VITE_LOG" 2>&1 < /dev/null &

  vite_pid=$!
  printf '%s\n' "$vite_pid" > "$VITE_PID_FILE"

  sleep 2
  if ! is_pid_alive "$vite_pid"; then
    rm -f "$VITE_PID_FILE"
    say "Vite failed to start. Recent log output:"
    tail -n 40 "$VITE_LOG" >&2 || true
    exit 1
  fi

  say "Vite started with PID $vite_pid."
}

cd "$ROOT_DIR"
mkdir -p "$LOG_DIR"

require_command npm

if [[ "$SKIP_INSTALL" != "1" && ! -d "$ROOT_DIR/node_modules" ]]; then
  say "node_modules is missing; running npm install."
  npm install
fi

if [[ "$SKIP_SUPABASE" != "1" ]]; then
  require_command supabase
  require_command docker
  say "Starting local Supabase."
  supabase start
  sync_local_supabase_env
else
  say "Skipping Supabase startup."
fi

start_vite

say "WorldBuilding development stack is up."
say "App: http://${HOST}:${PORT}"
if [[ "$SKIP_SUPABASE" != "1" ]]; then
  say "Supabase API: http://127.0.0.1:54321"
  say "Supabase Studio: http://127.0.0.1:54323"
  say "Inbucket: http://127.0.0.1:54324"
fi
say "Log: $VITE_LOG"
