"""Streamlit web page for the breast cancer prediction prototype.

The page collects 30 cell nucleus measurements, sends them to the prediction server
(server.py), shows the model's answer, and lets a doctor review that answer. The page
never loads the model itself: predictions, reviews, and retraining all happen on the server.

Streamlit reruns this whole script from top to bottom every time someone clicks or types,
so anything that must survive between reruns is kept in `st.session_state`.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import requests
import streamlit as st


# The 10 measurements taken from each cell nucleus image: (form key, label, unit).
FEATURES = [
    ("radius", "Radius", "dataset units"),
    ("texture", "Texture", "dataset units"),
    ("perimeter", "Perimeter", "dataset units"),
    ("area", "Area", "dataset units"),
    ("smoothness", "Smoothness", "dataset units"),
    ("compactness", "Compactness", "dataset units"),
    ("concavity", "Concavity", "dataset units"),
    ("concave_points", "Concave points", "dataset units"),
    ("symmetry", "Symmetry", "dataset units"),
    ("fractal_dimension", "Fractal dimension", "dataset units"),
]

# Tooltip text shown for each measurement field.
FEATURE_HELP = {
    "radius": "Average distance from the center of the cell nucleus to its boundary.",
    "texture": "Variation in gray-scale image values.",
    "perimeter": "Measured boundary length of the cell nucleus.",
    "area": "Measured area of the cell nucleus.",
    "smoothness": "Local variation in the radius measurements.",
    "compactness": "A contour measure derived from perimeter and area.",
    "concavity": "Severity of inward-curving portions of the contour.",
    "concave_points": "Number of inward-curving points on the contour.",
    "symmetry": "How similar the two sides of the contour are.",
    "fractal_dimension": "A measure of contour complexity.",
}

# Each measurement is reported three ways, giving 3 x 10 = 30 inputs: (key, label, description).
# Form keys combine a group and a feature, e.g. "mean_radius" or "worst_concave_points".
GROUPS = [
    ("mean", "Mean", "Average values across measured cell nuclei."),
    ("se", "Standard error", "Variation in each measurement across the sample."),
    ("worst", "Worst", "Largest or most irregular values for each feature."),
]

# Where the prediction server runs. Set BREAST_CANCER_API_URL to use a different address.
API_URL = os.environ.get("BREAST_CANCER_API_URL", "http://127.0.0.1:8000")
# Seconds to wait for the server before giving up.
REQUEST_TIMEOUT = 10
# Six real held-out test records used by the "Load held-out demo case" button.
DEMO_CASES_PATH = Path(__file__).resolve().parent / "demo_cases.json"


@st.cache_data(ttl=3, show_spinner=False)
def fetch_model_info() -> dict:
    """Ask the server which model is loaded. Cached briefly so each rerun does not call the server."""
    response = requests.get(f"{API_URL}/model", timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def api_error_message(error: Exception) -> str:
    """Turn a failed server request into a readable message, using the server's "detail" text if there is one."""
    if isinstance(error, requests.HTTPError) and error.response is not None:
        try:
            return str(error.response.json().get("detail", error.response.text))
        except ValueError:
            return error.response.text
    return str(error)


def clear_inputs() -> None:
    """Reset the form: forget every measurement, the loaded demo case, and the last prediction."""
    st.session_state["measurement_values"] = {}
    for group_key, _, _ in GROUPS:
        for feature_key, _, _ in FEATURES:
            input_key = f"{group_key}_{feature_key}"
            st.session_state.pop(f"field_{input_key}", None)
            st.session_state.pop(input_key, None)
    st.session_state["active_group"] = "mean"
    st.session_state.pop("active_demo_case", None)
    st.session_state.pop("last_prediction", None)


def persist_measurement(input_key: str, widget_key: str) -> None:
    """Save one field's value when it changes, and drop the old result because it no longer matches the inputs."""
    values = dict(st.session_state.get("measurement_values", {}))
    values[input_key] = st.session_state.get(widget_key)
    st.session_state["measurement_values"] = values
    st.session_state.pop("active_demo_case", None)
    st.session_state.pop("last_prediction", None)


def is_valid_measurement(value) -> bool:
    """Return True if the value is a real number of zero or more (not text, infinity, or NaN)."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and number >= 0


def load_demo_input() -> None:
    """Fill the form with the next demo case, cycling through cases 1 to 6 and back to 1."""
    if not demo_cases or model_info is None:
        return
    # Move to the next case, wrapping back to the first after the last.
    case_index = (st.session_state.get("last_demo_case_index", -1) + 1) % len(demo_cases)
    case = demo_cases[case_index]
    # Demo files use dataset names ("mean radius"); the form uses keys ("mean_radius").
    feature_to_key = dict(zip(model_info["input_features"], model_info["input_keys"]))
    values = {
        feature_to_key[feature_name]: float(value)
        for feature_name, value in case["features"].items()
    }
    st.session_state["last_demo_case_index"] = case_index
    # Remember which case was loaded so its real diagnosis can be shown next to the prediction.
    st.session_state["active_demo_case"] = {
        "number": case_index + 1,
        "true_label": case["true_label"],
    }
    st.session_state["measurement_values"] = values
    st.session_state.pop("last_prediction", None)
    # Put the values into the visible input boxes.
    for input_key, value in values.items():
        st.session_state[f"field_{input_key}"] = value


def load_demo_cases(path: Path) -> list:
    """Load the held-out demonstration cases saved as JSON."""
    with path.open(encoding="utf-8") as demo_file:
        cases = json.load(demo_file)
    if not isinstance(cases, list) or not cases:
        raise ValueError("The demo cases file must contain a non-empty JSON list.")
    return cases


def submit_review(prediction_id: int) -> None:
    """Send the doctor's verdict for one prediction to the server.

    This runs as the Submit button's callback, before the page reruns, so the server's reply
    is already stored when the page is redrawn.
    """
    prediction = st.session_state.get("last_prediction")
    # Ignore the click if a different prediction is now on screen.
    if not prediction or prediction["prediction_id"] != prediction_id:
        return
    try:
        # The toggle is on (True) when the doctor says the AI prediction was correct.
        response = requests.post(
            f"{API_URL}/predictions/{prediction_id}/review",
            json={"prediction_correct": bool(st.session_state.get(f"review_correct_{prediction_id}", False))},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        prediction["review_error"] = api_error_message(error)
        return
    # Store the server's reply; the review section shows it when the page is redrawn.
    prediction["review"] = response.json()
    prediction.pop("review_error", None)
    # Forget the cached model info so the header shows "retraining" straight away.
    fetch_model_info.clear()

# ---- Page setup ----
# Browser tab title, tab icon, and full-width layout. This must be the first Streamlit command on the page.
st.set_page_config(page_title="Breast Cancer Prediction Prototype", page_icon="✚", layout="wide")

# Every measurement typed so far lives in st.session_state["measurement_values"].
# Keep a durable copy separate from Streamlit's per-section widget state. Streamlit
# removes the widget state for a section when its controls are no longer rendered.
if "measurement_values" not in st.session_state:
    st.session_state["measurement_values"] = {
        f"{group}_{feature}": st.session_state.get(f"{group}_{feature}")
        for group, _, _ in GROUPS
        for feature, _, _ in FEATURES
        if st.session_state.get(f"{group}_{feature}") is not None
    }

# Custom CSS for the page's look: colours, cards, buttons, and layouts for smaller screens.
st.markdown(
    """
    <style>
      :root { color-scheme: light; }
      .stApp, [data-testid="stAppViewContainer"] { background:#f4f7fc; color:#1e2d49; }
      [data-testid="stHeader"], [data-testid="stToolbar"], #MainMenu, footer { visibility:hidden; height:0; }
      .block-container {max-width:1640px; padding:2.7rem 2rem 3rem;}
      h1, h2, h3, p { font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .page-heading {display:flex;justify-content:space-between;align-items:center;gap:2rem;margin-bottom:1.7rem;}
      .eyebrow {color:#2e6de5;font-size:.72rem;font-weight:800;letter-spacing:.17em;margin-bottom:.55rem;}
      .page-title {color:#17294b;font-size:2.25rem;font-weight:780;letter-spacing:-.04em;line-height:1.12;margin:0;}
      .page-subtitle {color:#71809c;font-size:1rem;margin:.55rem 0 0;line-height:1.5;}
      .progress-summary {width:19rem;flex:0 0 19rem;color:#53627c;font-size:.88rem;font-weight:700;}
      .progress-track {height:8px;margin-top:9px;overflow:hidden;background:#e6edf7;border-radius:99px;}
      .progress-value {height:100%;background:linear-gradient(90deg,#4b8df4,#244dc4);border-radius:inherit;transition:width .2s ease;}
      div[data-testid="stVerticalBlockBorderWrapper"] {background:#fff;border:1px solid #e4eaf3;border-radius:18px;box-shadow:0 10px 28px rgba(32,58,103,.055);padding:1.15rem 1.5rem 0;overflow:hidden;}
      .card-heading {display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.3rem .2rem .1rem;}
      .card-title {color:#17294b;font-size:1.18rem;font-weight:760;margin:0;}
      .card-description {color:#71809c;font-size:.9rem;margin:.35rem 0 0;line-height:1.45;}
      .card-divider {height:1px;border:0;background:#edf1f7;margin:.7rem -1.5rem 1rem;}
      .field-group-heading {display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:.1rem 0 .35rem;}
      .field-group-title {color:#203a67;font-size:1.1rem;font-weight:750;margin:0;}
      .field-group-description {color:#71809c;font-size:.9rem;margin:.25rem 0 0;}
      .group-count {padding:.35rem .7rem;border-radius:99px;background:#f1f5fb;color:#53627c;font-size:.78rem;font-weight:750;white-space:nowrap;}
      .field-label {display:flex;justify-content:space-between;gap:.4rem;margin:.4rem 0 .35rem;color:#334155;font-size:.84rem;font-weight:700;}
      .field-label small {color:#8996aa;font-size:.73rem;font-weight:550;}
      div[data-testid="stNumberInput"] input {height:47px!important;border:1px solid #dbe4f0!important;border-radius:10px!important;background:#fff!important;color:#1e2d49!important;font-size:.9rem!important;}
      div[data-testid="stNumberInput"] input:focus {border-color:#2e6de5!important;box-shadow:0 0 0 3px #2e6de522!important;}
      div[data-testid="stNumberInput"] button {display:none!important;}
      div.stButton > button {min-height:3rem;border-radius:11px;font-size:.9rem;font-weight:650;transition:all .15s ease;}
      div.stButton > button[kind="secondary"] {background:#fff;border:1px solid #dbe4f0;color:#203a67;}
      div.stButton > button[kind="secondary"]:hover {border-color:#9bb8ee;background:#f8faff;color:#203a67;}
      .st-key-measurement_stepper div.stButton > button {min-height:4.9rem;text-align:left;white-space:pre-line;line-height:1.45;padding:.7rem 1rem;}
      .st-key-measurement_stepper div.stButton > button[kind="primary"] {background:#f1f6ff;border:1px solid #6d9aff;color:#203a67;box-shadow:0 0 0 2px #2e6de51a;}
      .st-key-measurement_stepper div.stButton > button[kind="secondary"] {background:#fff;border:1px solid #dbe4f0;color:#53627c;}
      .st-key-prediction_actions {background:#fbfcfe;border-top:1px solid #edf1f7;margin:0 -1.5rem;padding:1rem 1.5rem;border-radius:0 0 20px 20px;}
      .st-key-prediction_actions div.stButton > button[kind="primary"] {background:linear-gradient(120deg,#3478ee,#285bd1);border:0;color:#fff;box-shadow:0 7px 14px #2e6de522;}
      .st-key-prediction_actions div.stButton > button[kind="primary"]:hover {filter:brightness(1.04);}
      .st-key-prediction_actions div.stButton > button:disabled {box-shadow:none;filter:saturate(.45);opacity:.65;}
      .result-panel {border:1px solid #cfddf5;border-radius:15px;background:#f1f6ff;padding:1.15rem 1.3rem;margin-top:1.2rem;}
      .result-title {font-size:1.1rem;font-weight:800;color:#17294b;margin:0 0 .65rem;}
      .result-class {font-size:1.5rem;font-weight:800;color:#203a67;margin-bottom:1rem;}
      .score-row {display:flex;gap:1rem;}
      .score-item {flex:1;background:#fff;border:1px solid #e0e9f6;border-radius:11px;padding:.75rem .9rem;}
      .score-label {font-size:.78rem;color:#71809c;font-weight:650;}
      .score-value {font-size:1.2rem;color:#17294b;font-weight:800;margin-top:.2rem;}
      .result-footnote, .privacy-note {color:#71809c;font-size:.82rem;line-height:1.5;}
      .result-footnote {margin:.85rem 0 0;}
      .privacy-note {margin:1.2rem 0 0;}
      .st-key-review_panel {margin-top:1rem;padding-bottom:1rem;}
      .review-title {font-size:1.1rem;font-weight:800;color:#17294b;margin:0 0 .3rem;}
      .review-description {color:#71809c;font-size:.88rem;line-height:1.5;margin:0 0 .6rem;}
      .review-summary {color:#334155;font-size:.92rem;margin:.2rem 0 .7rem;}
      .model-status {display:inline-flex;align-items:center;gap:.4rem;border-radius:999px;padding:.35rem .65rem;font-size:.75rem;font-weight:700;margin-top:.65rem;}
      .model-status.ready {color:#14785f;background:#e8f7f1;border:1px solid #ccecdf;}
      .model-status.attention {color:#92580b;background:#fff5df;border:1px solid #f4dfac;}
      .model-status.missing {color:#53627c;background:#f1f5fb;border:1px solid #e2e8f0;}
      .step-helper {color:#71809c;font-size:.78rem;align-self:center;text-align:right;padding-right:.5rem;}
      .st-key-feature_grid [data-testid="stHorizontalBlock"] {flex-wrap:wrap;gap:.8rem!important;}
      .st-key-feature_grid [data-testid="column"] {flex:1 1 calc(20% - .8rem)!important;min-width:145px;}
      @media(max-width:900px){.block-container{padding:2rem 1.2rem}.page-title{font-size:1.85rem}.progress-summary{width:14rem;flex-basis:14rem}}
      @media(max-width:900px){.st-key-feature_grid [data-testid="column"]{flex-basis:calc(33.333% - .8rem)!important;}}
      @media(max-width:650px){.block-container{padding:1.5rem .8rem 2rem}.page-heading{align-items:flex-start;flex-direction:column;gap:1rem}.progress-summary{width:100%;flex-basis:auto}.page-title{font-size:1.65rem}.st-key-measurement_stepper div.stButton > button{min-height:5rem;padding:.5rem;font-size:.8rem}.st-key-feature_grid [data-testid="column"]{flex-basis:calc(50% - .8rem)!important;min-width:120px}.score-row{flex-direction:column}}
    </style>
    """,
    unsafe_allow_html=True,
)

# ---- Server connection ----
# Ask the server which model is loaded. If the server is down, the page still loads,
# but predictions are disabled and an error explains how to start the server.
model_info = None
server_error = None
try:
    model_info = fetch_model_info()
except requests.RequestException as error:  # Keep the input form usable if the server is down.
    server_error = api_error_message(error)

# Text and colour of the status badge under the page title.
if model_info is not None:
    model_status = (
        f"● {model_info['model_name']} v{model_info['version']} loaded · "
        f"{model_info['training_records']} training records ({model_info['review_records']} from doctor reviews)"
    )
    if model_info.get("retraining"):
        model_status += " · retraining…"
    model_status_class = "ready"
else:
    model_status = "● Prediction server not reachable"
    model_status_class = "attention"

# Load the demo cases and check they use the same 30 measurements and labels as the model.
demo_cases = []
demo_cases_error = None
try:
    demo_cases = load_demo_cases(DEMO_CASES_PATH)
    if model_info is not None:
        expected_features = set(model_info.get("input_features", []))
        for case in demo_cases:
            if set(case.get("features", {})) != expected_features or case.get("true_label") not in model_info.get("target_names", []):
                raise ValueError("A demo case does not match the loaded model's feature schema or class labels.")
except (OSError, ValueError, json.JSONDecodeError) as error:
    demo_cases_error = str(error)

# ---- Page header ----
# Title, model status badge, and a progress bar showing how many of the 30 fields are filled.
measurement_values = st.session_state["measurement_values"]
filled_count = sum(1 for value in measurement_values.values() if value is not None)
st.markdown(
    f"""<div class="page-heading">
      <div><div class="eyebrow">PREDICTION</div><h1 class="page-title">Enter diagnostic measurements</h1>
      <p class="page-subtitle">Enter values from a WDBC measurement report. Each prediction is saved so a doctor can review it.</p>
      <div class="model-status {model_status_class}">{model_status}</div></div>
      <div class="progress-summary"><span>{filled_count} of 30 entered</span>
      <div class="progress-track"><div class="progress-value" style="width:{filled_count / 30 * 100:.1f}%"></div></div></div>
    </div>""",
    unsafe_allow_html=True,
)

# Explain how to start the server if it could not be reached.
if server_error:
    st.error(
        f"The prediction server at {API_URL} could not be reached: {server_error}. "
        "Start it with `uvicorn server:app --port 8000` (or use `./run`, which starts both)."
    )

# ---- Measurement form ----
# The main card: demo button, the three section tabs, the 10 fields of the chosen section,
# and the Clear / Get prediction buttons.
prediction_clicked = False
with st.container(border=True):
    title_column, test_column = st.columns([5, 1])
    with title_column:
        st.markdown(
            '<div class="card-heading"><div><h2 class="card-title">Cell nucleus measurements</h2>'
            '<p class="card-description">Complete each section using values from the diagnostic report.</p></div></div>',
            unsafe_allow_html=True,
        )
    # Demo button in the top-right corner of the card.
    with test_column:
        st.button(
            "Load held-out demo case",
            help="Load the next saved case from the held-out test set. Its true label is shown after you request a prediction.",
            on_click=load_demo_input,
            use_container_width=True,
            disabled=not demo_cases or model_info is None,
        )
        active_demo_case = st.session_state.get("active_demo_case")
        if active_demo_case:
            st.caption(f"Loaded held-out case {active_demo_case['number']} of {len(demo_cases)}")
        elif demo_cases_error:
            st.caption("Demo cases could not be loaded.")

    st.markdown('<hr class="card-divider">', unsafe_allow_html=True)

    # Three tabs (Mean, Standard error, Worst). Only one section's 10 fields are shown at a time.
    # Each tab shows a tick once all 10 of its fields are filled.
    active_group = st.session_state.get("active_group", "mean")
    with st.container(key="measurement_stepper"):
        group_columns = st.columns(3)
        for index, ((group_key, group_label, _), column) in enumerate(zip(GROUPS, group_columns)):
            group_filled = sum(
                1 for feature, _, _ in FEATURES
                if measurement_values.get(f"{group_key}_{feature}") is not None
            )
            step_marker = "✓" if group_filled == len(FEATURES) else str(index + 1)
            button_label = f"**{step_marker}   {group_label}**\n{group_filled}/10 fields"
            with column:
                if st.button(
                    button_label,
                    key=f"select_{group_key}",
                    type="primary" if active_group == group_key else "secondary",
                    use_container_width=True,
                ):
                    st.session_state["active_group"] = group_key
                    st.rerun()

    # Heading for the chosen section, with a count of how many of its fields are filled.
    active_group_label, active_group_help = next(
        (label, help_text) for key, label, help_text in GROUPS if key == active_group
    )
    active_filled = sum(
        1 for feature, _, _ in FEATURES
        if measurement_values.get(f"{active_group}_{feature}") is not None
    )
    heading_column, count_column = st.columns([12, 1])
    with heading_column:
        st.markdown(
            f'<div class="field-group-heading"><div><h3 class="field-group-title">{active_group_label} measurements</h3>'
            f'<p class="field-group-description">{active_group_help}</p></div></div>',
            unsafe_allow_html=True,
        )
    with count_column:
        st.markdown(f'<div class="group-count">{active_filled} / 10</div>', unsafe_allow_html=True)

    # The 10 number fields for the chosen section, in a grid of 5 columns.
    with st.container(key="feature_grid"):
        feature_columns = st.columns(5)
        for index, (feature_key, feature_label, unit) in enumerate(FEATURES):
            with feature_columns[index % 5]:
                st.markdown(
                    f'<div class="field-label"><span>{feature_label}</span><small>{unit}</small></div>',
                    unsafe_allow_html=True,
                )
                st.number_input(
                    f"{feature_label} ({unit})",
                    min_value=0.0,
                    step=0.01,
                    format="%.5g",
                key=f"field_{active_group}_{feature_key}",
                on_change=persist_measurement,
                args=(f"{active_group}_{feature_key}", f"field_{active_group}_{feature_key}"),
                    help=FEATURE_HELP[feature_key],
                    label_visibility="collapsed",
                # Give the field a starting value only the first time it is drawn. After that Streamlit
                # keeps the value itself, and passing it again would cause a warning.
                **(
                    {"value": measurement_values.get(f"{active_group}_{feature_key}")}
                    if f"field_{active_group}_{feature_key}" not in st.session_state
                    else {}
                ),
                )

    # Bottom row of the card. Get prediction is only enabled when all 30 fields are filled and the server is up.
    st.markdown('<hr class="card-divider">', unsafe_allow_html=True)
    with st.container(key="prediction_actions"):
        clear_column, helper_column, predict_column = st.columns([1, 3, 1.5])
        with clear_column:
            st.button("Clear inputs", on_click=clear_inputs, disabled=filled_count == 0, use_container_width=True)
        with helper_column:
            if filled_count < 30:
                st.markdown('<div class="step-helper">Enter all 30 values to request a model output.</div>', unsafe_allow_html=True)
        with predict_column:
            prediction_clicked = st.button(
                "Get prediction",
                type="primary",
                disabled=filled_count < 30 or model_info is None,
                use_container_width=True,
            )

# ---- Prediction ----
# Runs only on the rerun caused by clicking Get prediction: check the values, send them to the
# server, and save the server's answer in the session.
if prediction_clicked:
    input_values = {
        f"{group}_{feature}": measurement_values.get(f"{group}_{feature}")
        for group, _, _ in GROUPS
        for feature, _, _ in FEATURES
    }
    if any(value is None for value in input_values.values()):
        st.error("Enter all 30 measurements before requesting a prediction.")
    elif not all(is_valid_measurement(value) for value in input_values.values()):
        st.error("Enter a finite numeric measurement of zero or greater in each field.")
    elif model_info is None:
        st.error("The prediction server is not reachable, so no prediction can be made.")
    else:
        try:
            response = requests.post(
                f"{API_URL}/predictions",
                json={"features": {key: float(value) for key, value in input_values.items()}},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            st.error(f"The prediction request failed: {api_error_message(error)}")
        else:
            # Keep the result in the session so it stays visible while the doctor uses the review controls.
            st.session_state["last_prediction"] = {
                **response.json(),
                "demo_case": st.session_state.get("active_demo_case"),
            }

# ---- Result and doctor review ----
# Drawn on every rerun while a prediction is saved, so the result stays on screen while the
# doctor uses the toggle (every click on the page reruns this script).
last_prediction = st.session_state.get("last_prediction")
if last_prediction:
    prediction_id = last_prediction["prediction_id"]
    predicted_name = last_prediction["predicted_label"]
    score_card = (
        '<div class="score-item"><div class="score-label">Probability of malignancy</div>'
        f'<div class="score-value">{last_prediction["malignant_probability"]:.3%}</div></div>'
    )
    st.markdown(
        f'<div class="result-panel"><h2 class="result-title">Model output</h2>'
        f'<div class="result-class">Model classification: {predicted_name.title()}</div>'
        f'<div class="score-row">{score_card}</div>'
        '<p class="result-footnote">This model-estimated probability is not a calibrated estimate of individual risk. '
        'This output is not a diagnosis and must be interpreted by a qualified healthcare professional alongside clinical findings. '
        f'Prediction #{prediction_id}, model version {last_prediction["model_version"]}.</p></div>',
        unsafe_allow_html=True,
    )
    # For demo cases, show the real diagnosis next to the model's answer.
    demo_case = last_prediction.get("demo_case")
    if demo_case:
        actual_label = str(demo_case["true_label"]).title()
        match_text = "The prediction matches the true label." if predicted_name.lower() == actual_label.lower() else "The prediction differs from the true label."
        st.info(
            f"Held-out case {demo_case['number']} actual label: {actual_label}. "
            f"Model prediction: {predicted_name.title()}. {match_text}"
        )
    # Warn if any value is outside what the model saw in training; predictions there are less reliable.
    if last_prediction["out_of_range"]:
        st.warning(
            "One or more values are outside the training data ranges. The result may be unreliable. "
            "Out-of-range measurements: " + ", ".join(last_prediction["out_of_range"])
        )

    # The doctor review section under the answer.
    with st.container(border=True, key="review_panel"):
        st.markdown(
            '<h2 class="review-title">Doctor review</h2>'
            '<p class="review-description">Confirm whether the model classification matches the diagnosis. '
            'Confirmed cases are added to the training data and the model retrains in the background.</p>',
            unsafe_allow_html=True,
        )
        review = last_prediction.get("review")
        # Already reviewed: show what was saved instead of the controls.
        if review:
            verdict = "correct" if review["confirmed_label"] == predicted_name else "incorrect"
            message = f"Review saved: prediction marked {verdict}. Confirmed diagnosis: {review['confirmed_label'].title()}."
            if review["added_to_training"]:
                st.success(message + " The case was added to the training data and the model is retraining.")
            else:
                st.success(message)
                st.caption(review["excluded_reason"])
        else:
            # Toggle on means the AI was right. Toggle off means the diagnosis is the other class.
            # The line below the toggle shows which diagnosis will be saved.
            prediction_correct = st.toggle("The AI prediction is correct", key=f"review_correct_{prediction_id}")
            other_label = "benign" if predicted_name == "malignant" else "malignant"
            confirmed_label = predicted_name if prediction_correct else other_label
            st.markdown(
                f'<p class="review-summary">Diagnosis to be recorded: <strong>{confirmed_label.title()}</strong></p>',
                unsafe_allow_html=True,
            )
            st.button("Submit review", type="primary", key=f"submit_review_{prediction_id}",
                      on_click=submit_review, args=(prediction_id,))
            if last_prediction.get("review_error"):
                st.error(f"The review could not be saved: {last_prediction['review_error']}")

# Footer note about what is stored.
st.markdown(
    '<p class="privacy-note">Each prediction and its measurements are saved to the local database, along with any doctor review. '
    'No patient identity is requested or stored. This model is for demonstration only, not clinical use.</p>',
    unsafe_allow_html=True,
)
