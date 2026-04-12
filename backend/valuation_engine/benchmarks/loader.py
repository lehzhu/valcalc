import json
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"
_cache: dict | None = None


def load_benchmarks(version: str | None = None) -> dict:
    """Load benchmark data. Uses latest version if not specified."""
    global _cache
    if _cache is not None and version is None:
        return _cache

    if version:
        path = _DATA_DIR / f"benchmarks-{version}.json"
    else:
        files = sorted(_DATA_DIR.glob("benchmarks-*.json"))
        if not files:
            raise FileNotFoundError("No benchmark data files found")
        path = files[-1]

    with open(path) as f:
        data = json.load(f)

    if version is None:
        _cache = data
    return data


def get_sector_benchmarks(sector_key: str, version: str | None = None) -> dict:
    """Get benchmark data for a specific sector. Raises KeyError if not found."""
    data = load_benchmarks(version)
    sectors = data["sectors"]
    if sector_key not in sectors:
        raise KeyError(f"{sector_key}")
    return sectors[sector_key]


def list_sectors(version: str | None = None) -> list[dict]:
    """Return list of available sectors with keys and display names."""
    data = load_benchmarks(version)
    return [
        {"key": key, "display_name": sector["display_name"]}
        for key, sector in data["sectors"].items()
    ]


def get_benchmark_version(version: str | None = None) -> str:
    """Return the version string of the loaded benchmarks."""
    data = load_benchmarks(version)
    return data["metadata"]["version"]


def clear_cache():
    """Clear cached benchmark data. Used after benchmark refresh."""
    global _cache
    _cache = None
