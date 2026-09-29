"""Check the actual runtime requirements without contacting external services."""
import subprocess
import sys

if __name__ == "__main__":
    raise SystemExit(subprocess.call([sys.executable, "-m", "pip", "check"]))
