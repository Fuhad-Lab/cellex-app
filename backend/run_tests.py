#!/usr/bin/env python3
"""
Cellex Backend Test Runner

Runs all integration tests against the live deployed services.
"""

import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("CELLEX BACKEND — INTEGRATION TEST SUITE")
    print("=" * 60)

    # Install pytest if not available
    try:
        import pytest
    except ImportError:
        print("Installing pytest...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pytest", "httpx"])

    # Run tests
    test_dir = os.path.join(os.path.dirname(__file__), "tests")
    result = subprocess.run([
        sys.executable, "-m", "pytest", test_dir, "-v", "--tb=short"
    ], env={**os.environ, "PYTHONPATH": test_dir})

    print(f"\n{'=' * 60}")
    if result.returncode == 0:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ SOME TESTS FAILED (exit code {result.returncode})")
    print("=" * 60)

    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
