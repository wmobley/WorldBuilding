#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.worldbuilding-dev"
VITE_PID_FILE="$STATE_DIR/vite.pid"
KEEP_SUPABASE="${WORLD_BUILDING_KEEP_SUPABASE:-0}"

usage() {
  cat <<USAGE
Usage: npm run burndown [-- options]

Stops the WorldBuilding local development stack started by burnup:
  - Vite dev server recorded in .worldbuilding-dev/vite.pid
  - local Supabase, unless kept

Options:
  --keep-supabase   Leave local Supabase running.
  -h, --help        Show this help.

Environment:
  WORLD_BUILDING_KEEP_SUPABASE=1
USAGE
}

while (($#)); do
  case "$1" in
    --keep-supabase)
      KEEP_SUPABASE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf '[burndown] Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

say() {
  printf '[burndown] %s\n' "$*"
}

is_pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

stop_vite() {
  local pid

  if [[ ! -f "$VITE_PID_FILE" ]]; then
    say "No Vite PID file found."
    return 0
  fi

  pid="$(cat "$VITE_PID_FILE")"
  if ! is_pid_alive "$pid"; then
    say "Vite PID $pid is not running."
    rm -f "$VITE_PID_FILE"
    return 0
  fi

  say "Stopping Vite PID $pid."
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -P "$pid" >/dev/null 2>&1 || true
  fi
  kill -TERM "$pid" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! is_pid_alive "$pid"; then
      rm -f "$VITE_PID_FILE"
      say "Vite stopped."
      return 0
    fi
    sleep 0.25
  done

  say "Vite did not stop after SIGTERM; sending SIGKILL."
  if command -v pkill >/dev/null 2>&1; then
    pkill -KILL -P "$pid" >/dev/null 2>&1 || true
  fi
  kill -KILL "$pid" >/dev/null 2>&1 || true
  rm -f "$VITE_PID_FILE"
}

cd "$ROOT_DIR"

stop_vite

if [[ "$KEEP_SUPABASE" == "1" ]]; then
  say "Leaving Supabase running."
elif command -v supabase >/dev/null 2>&1; then
  say "Stopping local Supabase."
  supabase stop
else
  say "Supabase CLI is not installed; skipping Supabase stop."
fi

say "WorldBuilding development stack is down."
