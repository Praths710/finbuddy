"""Start the FinMind backend and frontend together. Ctrl+C stops both."""
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")
VENV_PY = os.path.join(BACKEND, "venv", "Scripts", "python.exe")

backend = subprocess.Popen(
    [VENV_PY, "-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
    cwd=BACKEND,
)
frontend = subprocess.Popen("npm start", cwd=FRONTEND, shell=True)

print("\nBackend:  http://localhost:8000\nFrontend: http://localhost:3000\nPress Ctrl+C to stop both.\n")

try:
    while backend.poll() is None and frontend.poll() is None:
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    for proc in (backend, frontend):
        if proc.poll() is None:
            # taskkill /T also stops the child processes npm spawns
            subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sys.exit(0)
