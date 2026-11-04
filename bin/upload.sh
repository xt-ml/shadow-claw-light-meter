#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FQBN="arduino:avr:pro:cpu=8MHzatmega328"
PORT="${1:-${PORT:-/dev/ttyUSB0}}"
SKETCH="${PROJECT_DIR}/firmware/shadow-claw-light-meter/shadow-claw-light-meter.ino"
LIB_DIR="${PROJECT_DIR}/firmware/lib/bglib/Arduino"
BUILD_DIR="${PROJECT_DIR}/build"

if [ ! -d "${LIB_DIR}" ] || [ ! -f "${LIB_DIR}/BGLib.h" ]; then
  echo "[INFO] Initializing bglib git submodule from https://github.com/jrowberg/bglib..."
  git -C "${PROJECT_DIR}" submodule update --init --recursive firmware/lib/bglib
fi

echo "[1/2] Compiling ${SKETCH} (${FQBN}) using BGLib submodule..."
arduino-cli compile \
  --fqbn "${FQBN}" \
  --library "${LIB_DIR}" \
  --output-dir "${BUILD_DIR}" \
  "${SKETCH}"

if [ "${1:-}" = "--compile-only" ] || [ "${NO_UPLOAD:-0}" = "1" ]; then
  echo "[OK] Compilation successful (upload skipped)."
  exit 0
fi

if [ ! -e "${PORT}" ]; then
  echo "[WARN] Port ${PORT} not found. Skipping upload. Pass PORT=<device> or specify port as argument."
  echo "[OK] Firmware compiled successfully to ${BUILD_DIR}."
  exit 0
fi

echo "[2/2] Uploading to TinyDuino on ${PORT}..."
arduino-cli upload \
  -p "${PORT}" \
  --fqbn "${FQBN}" \
  --input-dir "${BUILD_DIR}"

echo "[OK] Latest shadow-claw-light-meter.ino compiled and uploaded to ${PORT}."

