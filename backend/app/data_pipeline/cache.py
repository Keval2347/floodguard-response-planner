"""
Tiny disk cache.

Rule for this project: NEVER hit an external API twice for the same thing.
Overpass rate-limits, Earth Engine is slow, IMD is flaky. Everything we
download lands in backend/data/raw/ and is reused until it goes stale.

Design is deliberately dumb (a file on disk + an mtime check) so a student
can read it in one sitting. No Redis, no sqlite, no cache invalidation
cleverness.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

from app.config import get_config


def cache_path(name: str, suffix: str) -> Path:
    """Absolute path for a cache artefact, e.g. cache_path('roads', '.gpkg')."""
    cfg = get_config()
    return cfg.paths.raw_dir / f"{cfg.ward.short_name}__{name}{suffix}"


def is_fresh(path: Path, max_age_seconds: float) -> bool:
    """True if the file exists and is younger than max_age_seconds."""
    if not path.exists():
        return False
    if max_age_seconds <= 0:  # 0 or negative means "cache forever"
        return True
    return (time.time() - path.stat().st_mtime) < max_age_seconds


def static_ttl() -> float:
    """TTL for things that barely change: OSM geometry, terrain."""
    return float(get_config().cache.get("ttl_days_static", 30)) * 86400


def live_ttl() -> float:
    """TTL for the live rainfall nowcast."""
    return float(get_config().cache.get("ttl_hours_live", 1)) * 3600


def cached_file(
    name: str,
    suffix: str,
    ttl_seconds: float,
    producer: Callable[[Path], None],
    refresh: bool = False,
) -> Path:
    """
    Return the path to a cached artefact, producing it if missing/stale.

    `producer` is a function that takes the destination path and writes the
    file. It is only called on a cache miss. We write to a .tmp file first and
    rename, so an interrupted download can never leave a corrupt cache entry.
    """
    dest = cache_path(name, suffix)
    if not refresh and is_fresh(dest, ttl_seconds):
        print(f"  [cache hit ] {dest.name}")
        return dest

    print(f"  [fetching   ] {dest.name} ...")
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    producer(tmp)
    tmp.replace(dest)  # atomic on the same filesystem
    print(f"  [cached     ] {dest.name}")
    return dest


def cached_json(
    name: str,
    ttl_seconds: float,
    producer: Callable[[], Any],
    refresh: bool = False,
) -> Any:
    """Same idea as cached_file, but for small JSON payloads (API responses)."""
    dest = cache_path(name, ".json")
    if not refresh and is_fresh(dest, ttl_seconds):
        print(f"  [cache hit ] {dest.name}")
        return json.loads(dest.read_text(encoding="utf-8"))

    print(f"  [fetching   ] {dest.name} ...")
    payload = producer()
    dest.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"  [cached     ] {dest.name}")
    return payload
