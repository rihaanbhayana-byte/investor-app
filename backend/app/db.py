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


# ---------------------------------------------------------------------
# Writes for the practice portfolio. These use the SECRET key, which never
# leaves the backend. The backend checks who the user is before writing.
# ---------------------------------------------------------------------
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

_admin = requests.Session()
_admin.headers.update({"apikey": SUPABASE_SECRET_KEY})


def admin(method, table, params=None, json=None, prefer=None):
    """Read or write any table with the secret key (bypasses row level security)."""
    if not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is missing from the backend settings.")
    response = _admin.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params,
        json=json,
        headers={"Prefer": prefer} if prefer else {},
        timeout=30,
    )
    if not response.ok:
        hint = ""
        if "practice_" in table and response.status_code == 404:
            hint = " The practice tables are missing: run database/practice.sql in the Supabase SQL Editor."
        elif response.status_code in (401, 403):
            hint = " Check SUPABASE_SECRET_KEY in the .env file."
        raise RuntimeError(f"Supabase said {response.status_code}: {response.text[:200]}.{hint}")
    return response.json() if response.content else None


def get_user(access_token):
    """Ask Supabase who owns this login token. Returns the user, or None if the token is invalid."""
    response = _http.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    return response.json() if response.status_code == 200 else None


def delete_auth_user(user_id):
    """Delete a login (needs the SECRET key). Everything the user owns is removed too (on delete cascade)."""
    if not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is missing from the backend settings.")
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    response = _http.delete(url, headers={"apikey": SUPABASE_SECRET_KEY}, timeout=20)
    if response.status_code in (401, 403):  # some key types also want the Authorization header
        response = _http.delete(url, headers={"apikey": SUPABASE_SECRET_KEY, "Authorization": f"Bearer {SUPABASE_SECRET_KEY}"}, timeout=20)
    if response.status_code not in (200, 204):
        raise RuntimeError(f"Supabase said {response.status_code}: {response.text[:200]}")


def list_auth_users(page=1, per_page=200):
    """Logins with their email addresses (needs the SECRET key). Used only by the weekly email job."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {"apikey": SUPABASE_SECRET_KEY, "Authorization": f"Bearer {SUPABASE_SECRET_KEY}"}
    response = _http.get(url, params={"page": page, "per_page": per_page}, headers=headers, timeout=20)
    response.raise_for_status()
    return response.json().get("users", [])


def sign_out_everywhere(access_token):
    """End every session of the user who owns this token (all devices)."""
    try:
        _http.post(f"{SUPABASE_URL}/auth/v1/logout", params={"scope": "global"},
                   headers={"apikey": SUPABASE_SECRET_KEY or "", "Authorization": f"Bearer {access_token}"}, timeout=15)
    except Exception:
        pass  # the PIN is wiped either way; the app also signs out locally
