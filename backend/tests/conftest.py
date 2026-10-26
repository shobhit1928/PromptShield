"""
conftest.py — shared pytest fixtures and path setup.
Ensures the backend app package is importable regardless of the working directory.
"""
import sys
from pathlib import Path

# Add the backend directory to sys.path so `from app.xxx import yyy` works.
sys.path.insert(0, str(Path(__file__).parent.parent))
