"""SQLite storage for WDBC records, app predictions, doctor reviews, and model versions.

The original WDBC split is seeded once. Doctor-reviewed cases are added to the
training split only, so the held-out test split stays fixed across retraining.

The database is one file, data/breast_cancer.db, with four tables:
  records         training and test data (WDBC records and doctor-reviewed cases)
  model_versions  one row per training run, with its test scores
  predictions     every answer the app gives, with its measurements and model version
  reviews         a doctor's verdict on a prediction, and the training record it created

This file holds the schema (SCHEMA below) and small functions that read and write
these tables. server.py and train_model.py use these functions instead of writing SQL.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split


# Where the database file lives, and the settings for the one-time 80/20 train/test split.
DATABASE_PATH = Path(__file__).resolve().parent / "data" / "breast_cancer.db"
DATASET_NAME = "scikit-learn load_breast_cancer (Wisconsin Diagnostic Breast Cancer)"
SEED = 42
TEST_SIZE = 0.20


def app_input_key(dataset_feature_name: str) -> str:
    """Map a scikit-learn WDBC feature name to the Streamlit form key.

    For example: "mean radius" -> "mean_radius", "radius error" -> "se_radius",
    and "worst concave points" -> "worst_concave_points".
    """
    parts = dataset_feature_name.split()
    if parts[0] == "mean":
        group, feature_parts = "mean", parts[1:]
    elif parts[0] == "worst":
        group, feature_parts = "worst", parts[1:]
    elif parts[-1] == "error":
        group, feature_parts = "se", parts[:-1]
    else:
        raise ValueError(f"Unrecognized WDBC feature name: {dataset_feature_name}")
    return f"{group}_{'_'.join(feature_parts)}"


# Take feature and class names from the dataset itself so they are spelled the same everywhere.
# TARGET_NAMES is ["malignant", "benign"], so label 0 means malignant and 1 means benign.
_DATASET = load_breast_cancer()
FEATURE_NAMES = [str(name) for name in _DATASET.feature_names]
FEATURE_KEYS = [app_input_key(name) for name in FEATURE_NAMES]
TARGET_NAMES = [str(name) for name in _DATASET.target_names]

# Reusable pieces of SQL for the schema: the 30 measurement columns (e.g. "mean_radius REAL NOT NULL"),
# and a rule that only allows the two labels.
_FEATURE_COLUMNS = ",\n    ".join(f"{key} REAL NOT NULL" for key in FEATURE_KEYS)
_LABEL_CHECK = "CHECK ({column} IN ('malignant', 'benign'))"

# The database tables. "IF NOT EXISTS" makes this safe to run every time the server starts.
# "REFERENCES" links a row to a row in another table:
#   predictions.model_version_id -> the model that made the prediction
#   reviews.prediction_id        -> the prediction being reviewed (UNIQUE: one review each)
#   reviews.record_id            -> the training record created from the review, if any
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('wdbc', 'review')),
    source_index INTEGER UNIQUE,
    split TEXT NOT NULL CHECK (split IN ('training', 'testing')),
    label TEXT NOT NULL {_LABEL_CHECK.format(column="label")},
    created_at TEXT NOT NULL,
    {_FEATURE_COLUMNS}
);

CREATE TABLE IF NOT EXISTS model_versions (
    id INTEGER PRIMARY KEY,
    trained_at TEXT NOT NULL,
    training_records INTEGER NOT NULL,
    review_records INTEGER NOT NULL,
    best_c REAL NOT NULL,
    cv_roc_auc REAL NOT NULL,
    test_accuracy REAL NOT NULL,
    test_precision REAL NOT NULL,
    test_recall REAL NOT NULL,
    test_f1 REAL NOT NULL,
    test_roc_auc REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    model_version_id INTEGER REFERENCES model_versions(id),
    predicted_label TEXT NOT NULL {_LABEL_CHECK.format(column="predicted_label")},
    malignant_probability REAL NOT NULL,
    {_FEATURE_COLUMNS}
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    prediction_id INTEGER NOT NULL UNIQUE REFERENCES predictions(id),
    reviewed_at TEXT NOT NULL,
    prediction_correct INTEGER NOT NULL CHECK (prediction_correct IN (0, 1)),
    confirmed_label TEXT NOT NULL {_LABEL_CHECK.format(column="confirmed_label")},
    record_id INTEGER REFERENCES records(id),
    excluded_reason TEXT
);
"""


def utc_now() -> str:
    """Return the current time in UTC as text, e.g. "2026-10-26T19:49:36+00:00"."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect(path: Path = DATABASE_PATH) -> Iterator[sqlite3.Connection]:
    """Open a connection that commits on success, rolls back on error, and always closes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    # Return rows that can be read by column name, e.g. row["label"].
    connection.row_factory = sqlite3.Row
    # Enforce the links between tables, e.g. a review must point to a real prediction.
    connection.execute("PRAGMA foreign_keys = ON")
    # WAL mode lets requests read the database while the retraining thread writes to it.
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    """Create any tables that do not exist yet."""
    with connect() as connection:
        connection.executescript(SCHEMA)


def _insert(connection: sqlite3.Connection, table: str, fields: dict, values: list[float]) -> int:
    """Insert one row with the given fields plus the 30 measurement columns. Returns the new row's id."""
    columns = list(fields) + FEATURE_KEYS
    placeholders = ", ".join("?" for _ in columns)
    cursor = connection.execute(
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})",
        list(fields.values()) + [float(value) for value in values],
    )
    return int(cursor.lastrowid)


def seed_wdbc_records() -> bool:
    """Insert the stratified WDBC split once. Returns True if records were added."""
    with connect() as connection:
        # Seed only once. Later runs keep the existing records and reviews.
        existing = connection.execute("SELECT COUNT(*) FROM records WHERE source = 'wdbc'").fetchone()[0]
        if existing:
            return False
        # Keep original indices so the selected demonstration cases are auditable.
        all_indices = np.arange(len(_DATASET.target))
        # 80% training, 20% testing, keeping the benign/malignant mix (stratify). Seed 42 makes it repeatable.
        train_indices, test_indices = train_test_split(
            all_indices, test_size=TEST_SIZE, random_state=SEED, stratify=_DATASET.target
        )
        created_at = utc_now()
        for split, indices in (("training", train_indices), ("testing", test_indices)):
            for index in indices:
                _insert(connection, "records", {
                    "source": "wdbc",
                    "source_index": int(index),
                    "split": split,
                    "label": TARGET_NAMES[_DATASET.target[index]],
                    "created_at": created_at,
                }, _DATASET.data[index])
        return True


def fetch_split(connection: sqlite3.Connection, split: str) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Return features, string labels, and record sources for one split, in insertion order."""
    rows = connection.execute(
        f"SELECT source, label, {', '.join(FEATURE_KEYS)} FROM records WHERE split = ? ORDER BY id",
        (split,),
    ).fetchall()
    features = np.array([[row[key] for key in FEATURE_KEYS] for row in rows], dtype=float)
    labels = np.array([row["label"] for row in rows])
    sources = [row["source"] for row in rows]
    return features, labels, sources


def find_dataset_match(connection: sqlite3.Connection, values: list[float]) -> Optional[str]:
    """Return the split of a WDBC record with the same measurements, if there is one."""
    rows = connection.execute(
        f"SELECT split, {', '.join(FEATURE_KEYS)} FROM records WHERE source = 'wdbc'"
    ).fetchall()
    if not rows:
        return None
    dataset_values = np.array([[row[key] for key in FEATURE_KEYS] for row in rows], dtype=float)
    # Compare against every WDBC record, allowing only for tiny floating-point rounding differences.
    matches = np.flatnonzero(np.isclose(dataset_values, np.asarray(values, dtype=float), rtol=1e-9, atol=1e-12).all(axis=1))
    return str(rows[matches[0]]["split"]) if len(matches) else None


def insert_prediction(connection, model_version_id, predicted_label, malignant_probability, values) -> int:
    """Save one prediction the app made. Returns its id."""
    return _insert(connection, "predictions", {
        "created_at": utc_now(),
        "model_version_id": model_version_id,
        "predicted_label": predicted_label,
        "malignant_probability": float(malignant_probability),
    }, values)


def get_prediction(connection: sqlite3.Connection, prediction_id: int) -> Optional[sqlite3.Row]:
    """Return one prediction row, or None if the id does not exist."""
    return connection.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()


def get_review_for_prediction(connection: sqlite3.Connection, prediction_id: int) -> Optional[sqlite3.Row]:
    """Return the review of a prediction, or None if it has not been reviewed."""
    return connection.execute("SELECT * FROM reviews WHERE prediction_id = ?", (prediction_id,)).fetchone()


def insert_review_record(connection, label: str, values) -> int:
    """Add a doctor-confirmed case to the training split."""
    return _insert(connection, "records", {
        "source": "review",
        "source_index": None,
        "split": "training",
        "label": label,
        "created_at": utc_now(),
    }, values)


def insert_review(connection, prediction_id, prediction_correct, confirmed_label, record_id, excluded_reason) -> int:
    """Save a doctor's review. Returns its id.

    record_id is the training record the review created. It is None when the case was not used
    for training, and excluded_reason then says why.
    """
    cursor = connection.execute(
        "INSERT INTO reviews (prediction_id, reviewed_at, prediction_correct, confirmed_label, record_id, excluded_reason)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (prediction_id, utc_now(), int(prediction_correct), confirmed_label, record_id, excluded_reason),
    )
    return int(cursor.lastrowid)


def insert_model_version(connection, training_records, review_records, best_c, cv_roc_auc, test_results) -> int:
    """Record a training run's size, chosen C, and scores. Returns the new version number."""
    cursor = connection.execute(
        "INSERT INTO model_versions (trained_at, training_records, review_records, best_c, cv_roc_auc,"
        " test_accuracy, test_precision, test_recall, test_f1, test_roc_auc)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            utc_now(), training_records, review_records, float(best_c), float(cv_roc_auc),
            test_results["accuracy"], test_results["precision"], test_results["recall"],
            test_results["f1"], test_results["roc_auc"],
        ),
    )
    return int(cursor.lastrowid)


def latest_model_version(connection: sqlite3.Connection) -> Optional[sqlite3.Row]:
    """Return the newest model version row, or None before the first training run."""
    return connection.execute("SELECT * FROM model_versions ORDER BY id DESC LIMIT 1").fetchone()
