"""Read data from Supabase using the public (publishable) key."""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]

_http = requests.Session()
_http.headers.update({"apikey": SUPABASE_KEY})


def select(table, params, page_size=1000):
    """Return all matching rows. Supabase sends at most 1000 per request, so read page by page."""
    rows, offset = [], 0
    while True:
        response = _http.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={**params, "limit": page_size, "offset": offset},
            timeout=30,
        )
        response.raise_for_status()
        batch = response.json()
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
        offset += page_size
