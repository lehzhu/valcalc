#!/usr/bin/env bash
set -e

# ValCalc startup script
# Starts both backend and frontend, handles port conflicts automatically.

BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo "Shutting down..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

find_free_port() {
    local port=$1
    while lsof -i :"$port" >/dev/null 2>&1; do
        echo "  Port $port in use, trying $((port + 1))..." >&2
        port=$((port + 1))
    done
    echo "$port"
}

# ── Backend setup ────────────────────────────────────────────────────

echo "=== ValCalc Startup ==="
echo ""

cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
    echo "[backend] Creating virtual environment..."
    python3 -m venv .venv
fi

echo "[backend] Activating venv..."
source .venv/bin/activate

if ! python -c "import fastapi" 2>/dev/null; then
    echo "[backend] Installing dependencies..."
    pip install -e ".[dev]" -q
fi

if [ ! -f "vc_audit.db" ] || [ ! -s "vc_audit.db" ]; then
    echo "[backend] Seeding database..."
    python scripts/seed_data.py
fi

BACKEND_PORT=$(find_free_port "$BACKEND_PORT")
echo "[backend] Starting on port $BACKEND_PORT..."
uvicorn api.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$BACKEND_PORT/api/v1/companies" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

if ! curl -sf "http://localhost:$BACKEND_PORT/api/v1/companies" >/dev/null 2>&1; then
    echo "[backend] Failed to start. Check logs above."
    exit 1
fi
echo "[backend] Ready at http://localhost:$BACKEND_PORT"

# ── Frontend setup ───────────────────────────────────────────────────

cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "[frontend] Installing dependencies..."
    npm install --silent
fi

FRONTEND_PORT=$(find_free_port "$FRONTEND_PORT")

# Update the API base URL if backend port changed from default
export VITE_API_BASE="http://localhost:$BACKEND_PORT"

echo "[frontend] Starting on port $FRONTEND_PORT..."
npx vite --port "$FRONTEND_PORT" --host &
FRONTEND_PID=$!

# Wait for frontend
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

echo ""
echo "=== ValCalc Running ==="
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  API docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

wait
