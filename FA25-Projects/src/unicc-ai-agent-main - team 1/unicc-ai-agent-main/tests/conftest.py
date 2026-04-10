import pytest
import sys
import os

# 添加 src 目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


def pytest_addoption(parser):
    parser.addoption(
        "--model",
        action="store",
        default=None,
        help="Model ID to use for live probes (e.g., openai/gpt-4o)",
    )


