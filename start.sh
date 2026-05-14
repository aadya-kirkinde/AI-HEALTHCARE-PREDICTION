#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "========================================="
echo " OutbreakOS API  http://localhost:8000"
echo " Docs            http://localhost:8000/docs"
echo "========================================="
echo ""

uvicorn server:app --reload --port 8000 --host 0.0.0.0
