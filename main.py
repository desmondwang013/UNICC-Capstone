"""
Root-level entry point — allows running `uvicorn main:app` from the repo root.
Adds src/backend to sys.path so all backend modules resolve correctly.
"""
import sys
import os
import importlib.util

_backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "backend")
sys.path.insert(0, _backend_dir)

# Load src/backend/main.py without triggering a circular import on this file
_spec = importlib.util.spec_from_file_location("backend_main", os.path.join(_backend_dir, "main.py"))
_mod  = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

app = _mod.app
