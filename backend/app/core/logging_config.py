import logging
import os
import sys

def setup_logging():
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-24s | %(message)s",
        datefmt="%H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger("shopagent")
    root.setLevel(level)

    # Avoid duplicate handlers if setup_logging is invoked multiple times
    root.handlers.clear()
    root.addHandler(handler)
    root.propagate = False  # avoid duplicate lines if uvicorn/FastAPI's own logger also has a handler

    return root

def get_logger(name: str) -> logging.Logger:
    """Module-scoped logger, e.g. get_logger('agent'), get_logger('cart'), get_logger('auth')."""
    return logging.getLogger(f"shopagent.{name}")
