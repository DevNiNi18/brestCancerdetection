"""API server that makes predictions, stores doctor reviews, and retrains the model.

Every prediction is saved to the SQLite database. When a doctor reviews one, the
confirmed case joins the training split and the model retrains in the background.
Start it with `uvicorn server:app --port 8000`.

Only certified clinicians can use it. They sign in with an account made by
manage_users.py, and send the token they get back as "Authorization: Bearer <token>".

Endpoints (interactive docs at http://127.0.0.1:8000/docs while it runs):
  GET  /health                         is the server up?                       (no sign-in needed)
  POST /auth/login                     sign in with email and password         (no sign-in needed)
  POST /auth/logout                    end this sign-in
  GET  /auth/me                        who is signed in
  GET  /model                          which model version is loaded, and its scores
  POST /predictions                    predict from 30 measurements and save the prediction
  POST /predictions/{id}/review        save a doctor's verdict and trigger retraining
"""

import logging
import math
import sqlite3
import threading
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

import joblib
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

import auth
import database
import train_model


# Use uvicorn's logger so messages appear in the server's terminal output.
logger = logging.getLogger("uvicorn.error")


# Request and response shapes. FastAPI checks incoming JSON against these and rejects bad input
# with a 422 error. They also appear in the interactive docs at /docs.
class PredictionRequest(BaseModel):
    """The 30 measurements, keyed like "mean_radius"."""
    features: Dict[str, float]


class PredictionResponse(BaseModel):
    """The model's answer, plus the prediction id needed to review it."""
    prediction_id: int
    predicted_label: str
    malignant_probability: float
    model_version: Optional[int]
    out_of_range: List[str]


class ReviewRequest(BaseModel):
    """The doctor's verdict: true if the AI prediction was correct."""
    prediction_correct: bool


class ReviewResponse(BaseModel):
    """What was saved, and whether the case was added to the training data."""
    review_id: int
    confirmed_label: str
    added_to_training: bool
    excluded_reason: Optional[str]
    retraining_queued: bool


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    """The signed-in clinician. The licence number and password hash are never sent back."""
    email: str
    full_name: str


class LoginResponse(BaseModel):
    """The token to send with every later request, and when it stops working."""
    token: str
    expires_at: str
    user: UserResponse


class ModelStore:
    """Hold the loaded model and retrain it on one background thread after new reviews."""

    def __init__(self) -> None:
        self.bundle: Optional[dict] = None
        self.retraining = False
        # A flag that the review endpoint raises to ask for a retrain.
        self._requested = threading.Event()
        # One background thread does all retraining, so two retrains never run at once.
        self._worker = threading.Thread(target=self._retrain_loop, name="retrainer", daemon=True)

    def load(self) -> None:
        """Load the saved model file into memory. Requests use the new model from then on."""
        self.bundle = joblib.load(train_model.MODEL_PATH)

    def start(self) -> None:
        """Start the background retraining thread."""
        self._worker.start()

    def request_retrain(self) -> None:
        """Ask for a retrain. Returns immediately; the work happens on the background thread."""
        # Reviews that arrive during a retrain are picked up by the next run.
        self.retraining = True
        self._requested.set()

    def _retrain_loop(self) -> None:
        """Forever: wait for a retrain request, retrain from the database, and switch to the new model."""
        while True:
            self._requested.wait()
            self._requested.clear()
            try:
                # Predictions keep using the old model until load() swaps in the new one.
                bundle = train_model.train_and_save()
                self.load()
                logger.info(
                    "Retrained model version %s on %s records (%s from doctor reviews).",
                    bundle["version"], bundle["training_records"], bundle["review_records"],
                )
            except Exception:
                logger.exception("Retraining failed; the previous model stays in use.")
            finally:
                # Stay marked as retraining if another review arrived in the meantime.
                self.retraining = self._requested.is_set()


# The one model store shared by every request.
store = ModelStore()


def prepare_model() -> None:
    """Create and seed the database, and train if the saved model is not the latest database version."""
    database.init_db()
    if database.seed_wdbc_records():
        logger.info("Seeded %s with the WDBC training and test split.", database.DATABASE_PATH)
    with database.connect() as connection:
        latest = database.latest_model_version(connection)
    # The committed model file may have no version number, or come from an older database.
    # Retrain if so, to keep the model file and the database's latest version in step.
    saved_version = None
    if train_model.MODEL_PATH.exists():
        saved_version = joblib.load(train_model.MODEL_PATH).get("version")
    if latest is None or saved_version != latest["id"]:
        logger.info("Training a model from the database records...")
        train_model.train_and_save()
    store.load()
    if database.seed_demo_user():
        logger.warning(
            "Created the demo clinician account %s (password %s). Change its password with "
            "`python manage_users.py set-password %s` before real use.",
            database.DEMO_USER_EMAIL, database.DEMO_USER_PASSWORD, database.DEMO_USER_EMAIL,
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Set up the database and model when the server starts, before it accepts requests."""
    prepare_model()
    store.start()
    yield


app = FastAPI(title="Breast Cancer Prediction Server", lifespan=lifespan)


def current_bundle() -> dict:
    """Return the loaded model, or answer 503 (service unavailable) if it is not ready yet."""
    if store.bundle is None:
        raise HTTPException(status_code=503, detail="The model is not loaded yet.")
    return store.bundle


# Reads the "Authorization: Bearer <token>" header. auto_error=False lets current_user()
# answer a missing header with the same 401 message as a wrong token.
bearer_scheme = HTTPBearer(auto_error=False)


def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> sqlite3.Row:
    """Return the signed-in clinician, or answer 401 (not signed in). Endpoints that list this
    as a dependency cannot be used without a valid, unexpired token from an active account."""
    user = None
    if credentials is not None:
        with database.connect() as connection:
            user = database.get_session_user(connection, auth.token_hash(credentials.credentials))
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Sign in as a certified clinician to use this service.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@app.get("/health")
def health() -> dict:
    """Simple check that the server is running. ./run uses it to know when to start the app."""
    return {"status": "ok"}


@app.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest) -> LoginResponse:
    """Check an email and password, and start a session for an active account."""
    with database.connect() as connection:
        user = database.get_user_by_email(connection, request.email.strip())
        # Check a password even for unknown emails, so both kinds of failure take as long.
        password_ok = auth.verify_password(request.password, user["password_hash"] if user else auth.DUMMY_HASH)
        # One message for every failure, so it does not reveal which emails have accounts.
        if user is None or not password_ok or not user["active"]:
            raise HTTPException(status_code=401, detail="The email or password is incorrect, or the account is disabled.")
        token = auth.new_token()
        expires_at = auth.session_expiry()
        database.insert_session(connection, auth.token_hash(token), user["id"], expires_at)
    logger.info("Clinician %s signed in.", user["email"])
    return LoginResponse(
        token=token,
        expires_at=expires_at,
        user=UserResponse(email=user["email"], full_name=user["full_name"]),
    )


@app.post("/auth/logout", status_code=204)
def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    _: sqlite3.Row = Depends(current_user),
) -> None:
    """End the session for the token sent with this request."""
    with database.connect() as connection:
        database.delete_session(connection, auth.token_hash(credentials.credentials))


@app.get("/auth/me", response_model=UserResponse)
def me(user: sqlite3.Row = Depends(current_user)) -> UserResponse:
    """Return who is signed in with this token."""
    return UserResponse(email=user["email"], full_name=user["full_name"])


@app.get("/model", dependencies=[Depends(current_user)])
def model_info() -> dict:
    """Describe the loaded model: version, feature names, training size, test scores, and retraining status."""
    bundle = current_bundle()
    return {
        "model_name": bundle["model_name"],
        "version": bundle.get("version"),
        "input_features": bundle["input_features"],
        "input_keys": bundle["input_keys"],
        "target_names": bundle["target_names"],
        "training_records": bundle.get("training_records"),
        "review_records": bundle.get("review_records"),
        "test_metrics": {
            key: value for key, value in bundle.get("test_metrics", {}).items()
            if key in {"accuracy", "precision", "recall", "f1", "roc_auc"}
        },
        "retraining": store.retraining,
    }


@app.post("/predictions", response_model=PredictionResponse, dependencies=[Depends(current_user)])
def create_prediction(request: PredictionRequest) -> PredictionResponse:
    """Predict benign or malignant from 30 measurements, and save the prediction to the database."""
    bundle = current_bundle()
    input_keys = bundle["input_keys"]
    # Check the input: exactly the 30 expected measurements, each a finite number of zero or more.
    if set(request.features) != set(input_keys):
        missing = sorted(set(input_keys) - set(request.features))
        unexpected = sorted(set(request.features) - set(input_keys))
        raise HTTPException(status_code=422, detail={"missing": missing, "unexpected": unexpected})
    values = [float(request.features[key]) for key in input_keys]
    if not all(math.isfinite(value) and value >= 0 for value in values):
        raise HTTPException(status_code=422, detail="Every measurement must be a finite number of zero or greater.")

    # List any value outside the range seen in training; the app shows these as a warning.
    out_of_range = []
    for key, name, value in zip(input_keys, bundle["input_features"], values):
        lower, upper = bundle["training_ranges"][key]["min"], bundle["training_ranges"][key]["max"]
        if value < lower or value > upper:
            out_of_range.append(f"{name} ({lower:.5g}–{upper:.5g})")

    # Ask the model for its class and its probability of malignancy.
    estimator = bundle["model"]
    class_names = bundle["target_names"]
    predicted_label = class_names[int(estimator.predict([values])[0])]
    class_labels = [int(label) for label in estimator.classes_]
    malignant_index = class_labels.index(bundle["positive_class_label"])
    malignant_probability = float(estimator.predict_proba([values])[0][malignant_index])

    # Save the prediction so a doctor can review it later.
    with database.connect() as connection:
        prediction_id = database.insert_prediction(
            connection, bundle.get("version"), predicted_label, malignant_probability, values
        )
    return PredictionResponse(
        prediction_id=prediction_id,
        predicted_label=predicted_label,
        malignant_probability=malignant_probability,
        model_version=bundle.get("version"),
        out_of_range=out_of_range,
    )


@app.post("/predictions/{prediction_id}/review", response_model=ReviewResponse)
def review_prediction(
    prediction_id: int, request: ReviewRequest, user: sqlite3.Row = Depends(current_user)
) -> ReviewResponse:
    """Save a doctor's verdict on a prediction and, if the case is new, add it to training and retrain."""
    with database.connect() as connection:
        # Reject unknown predictions (404) and second reviews of the same prediction (409).
        prediction = database.get_prediction(connection, prediction_id)
        if prediction is None:
            raise HTTPException(status_code=404, detail="Prediction not found.")
        if database.get_review_for_prediction(connection, prediction_id) is not None:
            raise HTTPException(status_code=409, detail="This prediction has already been reviewed.")

        # Work out the real diagnosis: the AI's answer if it was right, otherwise the other class.
        predicted_label = prediction["predicted_label"]
        if request.prediction_correct:
            confirmed_label = predicted_label
        else:
            confirmed_label = "benign" if predicted_label == "malignant" else "malignant"

        values = [prediction[key] for key in database.FEATURE_KEYS]
        # A held-out test record must never reach training, or the test scores stop being honest.
        match = database.find_dataset_match(connection, values)
        record_id = None
        excluded_reason = None
        if match == "testing":
            excluded_reason = "These measurements match a held-out test record, so they are not used for training."
        elif match == "training":
            excluded_reason = "These measurements are already in the training data."
        else:
            record_id = database.insert_review_record(connection, confirmed_label, values)

        review_id = database.insert_review(
            connection, prediction_id, request.prediction_correct, confirmed_label, record_id, excluded_reason,
            user["id"],
        )

    # Retrain only if the training data actually changed. The retrain runs in the background,
    # so the doctor gets an answer straight away instead of waiting for it.
    if record_id is not None:
        store.request_retrain()
    return ReviewResponse(
        review_id=review_id,
        confirmed_label=confirmed_label,
        added_to_training=record_id is not None,
        excluded_reason=excluded_reason,
        retraining_queued=record_id is not None,
    )
