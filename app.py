from __future__ import annotations

import random
from pathlib import Path

import joblib
import streamlit as st


FEATURES = [
    ("radius", "Radius", "mm"),
    ("texture", "Texture", "gray scale"),
    ("perimeter", "Perimeter", "mm"),
    ("area", "Area", "mm²"),
    ("smoothness", "Smoothness", "ratio"),
    ("compactness", "Compactness", "ratio"),
    ("concavity", "Concavity", "ratio"),
    ("concave_points", "Concave points", "count"),
    ("symmetry", "Symmetry", "ratio"),
    ("fractal_dimension", "Fractal dimension", "ratio"),
]

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

GROUPS = [
    ("mean", "Mean", "Average values across measured cell nuclei."),
    ("se", "Standard error", "Variation in each measurement across the sample."),
    ("worst", "Worst", "Largest or most irregular values for each feature."),
]

# Example WDBC feature vector used only to make non-clinical test inputs.
EXAMPLE = {
    "mean_radius": 17.99,
    "mean_texture": 10.38,
    "mean_perimeter": 122.8,
    "mean_area": 1001.0,
    "mean_smoothness": 0.1184,
    "mean_compactness": 0.2776,
    "mean_concavity": 0.3001,
    "mean_concave_points": 0.1471,
    "mean_symmetry": 0.2419,
    "mean_fractal_dimension": 0.07871,
    "se_radius": 1.095,
    "se_texture": 0.9053,
    "se_perimeter": 8.589,
    "se_area": 153.4,
    "se_smoothness": 0.006399,
    "se_compactness": 0.04904,
    "se_concavity": 0.05373,
    "se_concave_points": 0.01587,
    "se_symmetry": 0.03003,
    "se_fractal_dimension": 0.006193,
    "worst_radius": 25.38,
    "worst_texture": 17.33,
    "worst_perimeter": 184.6,
    "worst_area": 2019.0,
    "worst_smoothness": 0.1622,
    "worst_compactness": 0.6656,
    "worst_concavity": 0.7119,
    "worst_concave_points": 0.2654,
    "worst_symmetry": 0.4601,
    "worst_fractal_dimension": 0.1189,
}

MODEL_PATH = Path(__file__).resolve().parent / "models" / "breast_cancer_random_forest.joblib"


@st.cache_resource
def load_model_bundle(model_path: str, modified_time: float):
    """Load a locally trained model once, and refresh the cache if it changes."""
    del modified_time  # Included as a cache key so retraining reloads the bundle.
    return joblib.load(model_path)


def clear_inputs() -> None:
    st.session_state["measurement_values"] = {}
    for group_key, _, _ in GROUPS:
        for feature_key, _, _ in FEATURES:
            input_key = f"{group_key}_{feature_key}"
            st.session_state.pop(f"field_{input_key}", None)
            st.session_state.pop(input_key, None)
    st.session_state["active_group"] = "mean"


def persist_measurement(input_key: str, widget_key: str) -> None:
    values = dict(st.session_state.get("measurement_values", {}))
    values[input_key] = st.session_state.get(widget_key)
    st.session_state["measurement_values"] = values


def load_test_input() -> None:
    values = {}
    for feature, _, _ in FEATURES:
        mean = EXAMPLE[f"mean_{feature}"] * random.uniform(0.88, 1.12)
        standard_error = EXAMPLE[f"se_{feature}"] * random.uniform(0.80, 1.20)
        worst_ratio = EXAMPLE[f"worst_{feature}"] / EXAMPLE[f"mean_{feature}"]
        values[f"mean_{feature}"] = float(f"{mean:.5g}")
        values[f"se_{feature}"] = float(f"{standard_error:.5g}")
        values[f"worst_{feature}"] = float(f"{mean * worst_ratio * random.uniform(0.92, 1.08):.5g}")

    st.session_state["measurement_values"] = values
    for input_key, value in values.items():
        st.session_state[f"field_{input_key}"] = value

st.set_page_config(page_title="BreastCare AI · Prediction", page_icon="✚", layout="wide")

# Keep a durable copy separate from Streamlit's per-section widget state. Streamlit
# removes the widget state for a section when its controls are no longer rendered.
if "measurement_values" not in st.session_state:
    st.session_state["measurement_values"] = {
        f"{group}_{feature}": st.session_state.get(f"{group}_{feature}")
        for group, _, _ in GROUPS
        for feature, _, _ in FEATURES
        if st.session_state.get(f"{group}_{feature}") is not None
    }

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

model_bundle = None
model_load_error = None
if MODEL_PATH.exists():
    try:
        model_bundle = load_model_bundle(str(MODEL_PATH), MODEL_PATH.stat().st_mtime)
    except Exception as error:  # Keep the input form usable if the artifact is missing or incompatible.
        model_load_error = str(error)

if model_bundle is not None:
    model_status = "● Demo model loaded"
    model_status_class = "ready"
elif model_load_error:
    model_status = "● Model needs attention"
    model_status_class = "attention"
else:
    model_status = "● Train the model to begin"
    model_status_class = "missing"

measurement_values = st.session_state["measurement_values"]
filled_count = sum(1 for value in measurement_values.values() if value is not None)
st.markdown(
    f"""<div class="page-heading">
      <div><div class="eyebrow">PREDICTION</div><h1 class="page-title">Enter diagnostic measurements</h1>
      <p class="page-subtitle">Enter values from a WDBC measurement report. Your entries stay in this session.</p>
      <div class="model-status {model_status_class}">{model_status}</div></div>
      <div class="progress-summary"><span>{filled_count} of 30 entered</span>
      <div class="progress-track"><div class="progress-value" style="width:{filled_count / 30 * 100:.1f}%"></div></div></div>
    </div>""",
    unsafe_allow_html=True,
)

prediction_clicked = False
with st.container(border=True):
    title_column, test_column = st.columns([5, 1])
    with title_column:
        st.markdown(
            '<div class="card-heading"><div><h2 class="card-title">Cell nucleus measurements</h2>'
            '<p class="card-description">Complete each section using values from the diagnostic report.</p></div></div>',
            unsafe_allow_html=True,
        )
    with test_column:
        st.button(
            "Use test input",
            help="Fill all 30 fields with randomized example values.",
            on_click=load_test_input,
            use_container_width=True,
        )

    st.markdown('<hr class="card-divider">', unsafe_allow_html=True)

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
                **(
                    {"value": measurement_values.get(f"{active_group}_{feature_key}")}
                    if f"field_{active_group}_{feature_key}" not in st.session_state
                    else {}
                ),
                )

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
                disabled=filled_count < 30,
                use_container_width=True,
            )

if prediction_clicked:
    input_values = {
        f"{group}_{feature}": measurement_values.get(f"{group}_{feature}")
        for group, _, _ in GROUPS
        for feature, _, _ in FEATURES
    }
    if any(value is None for value in input_values.values()):
        st.error("Enter all 30 measurements before requesting a prediction.")
    elif model_load_error:
        st.error(f"The trained model could not be loaded: {model_load_error}")
    elif model_bundle is None:
        st.error("No trained model was found. Run `python train_model.py` first.")
    else:
        expected_keys = model_bundle["input_keys"]
        all_keys = set(input_values)
        if len(expected_keys) != 30 or set(expected_keys) != all_keys:
            st.error("The model's feature schema does not match the 30 inputs in this app.")
        else:
            ordered_values = [[float(input_values[key]) for key in expected_keys]]
            estimator = model_bundle["model"]
            predicted_label = int(estimator.predict(ordered_values)[0])
            class_labels = [int(label) for label in estimator.classes_]
            class_names = model_bundle["target_names"]
            scores = estimator.predict_proba(ordered_values)[0]
            score_by_name = {
                str(class_names[label]): float(score)
                for label, score in zip(class_labels, scores)
            }

            score_cards = "".join(
                f'<div class="score-item"><div class="score-label">{str(class_names[label]).title()} class score</div>'
                f'<div class="score-value">{score_by_name[str(class_names[label]).lower()]:.1%}</div></div>'
                for label in class_labels
            )
            st.markdown(
                f'<div class="result-panel"><h2 class="result-title">Model output</h2>'
                f'<div class="result-class">Model classification: {class_names[predicted_label].title()}</div>'
                f'<div class="score-row">{score_cards}</div>'
                '<p class="result-footnote">Class scores are Random Forest outputs, not calibrated patient risk. '
                'This demonstration model is not validated for clinical use.</p></div>',
                unsafe_allow_html=True,
            )

st.markdown(
    '<p class="privacy-note">Inputs stay in this page session and are cleared when you leave or clear the form. '
    'No patient identity is requested or stored. This model is for demonstration only, not clinical use.</p>',
    unsafe_allow_html=True,
)
