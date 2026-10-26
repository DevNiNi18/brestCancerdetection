"""Password hashing and sign-in tokens for clinician accounts.

Passwords are never stored. Each account keeps a salted PBKDF2-SHA256 hash instead, so
a copy of the database does not reveal anyone's password. Sign-in tokens are random
strings given to the app; the database keeps only their SHA-256 hash, so a leaked
database cannot be used to sign in either.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

# PBKDF2 settings. More iterations make each guess slower for an attacker.
HASH_ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
# A sign-in lasts one working shift, then the clinician signs in again.
SESSION_HOURS = 8
MIN_PASSWORD_LENGTH = 10


def hash_password(password: str) -> str:
    """Return "pbkdf2_sha256$<iterations>$<salt>$<hash>" for storing in users.password_hash."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS)
    return f"{HASH_ALGORITHM}${ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Return True if the password matches the stored hash."""
    try:
        algorithm, iterations, salt, expected = stored.split("$")
    except ValueError:
        return False
    if algorithm != HASH_ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    # compare_digest takes the same time whether the first or last character differs.
    return hmac.compare_digest(digest.hex(), expected)


# Checked against when the username does not exist, so a wrong username takes as long
# as a wrong password and the response time does not reveal which usernames exist.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def new_token() -> str:
    """Return a new random sign-in token to hand to the app."""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Return the form of a token that is stored in the sessions table."""
    return hashlib.sha256(token.encode()).hexdigest()


def session_expiry() -> str:
    """Return when a session started now expires, in the same UTC text format as database.utc_now()."""
    expires = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
    return expires.isoformat(timespec="seconds")
