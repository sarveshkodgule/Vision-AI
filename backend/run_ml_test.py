"""Run the bundled model integration examples from any working directory."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("test_integration.py")), run_name="__main__")
