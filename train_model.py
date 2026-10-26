"""Tune, evaluate, and save a Logistic Regression WDBC breast-cancer classifier.

Training records come from the SQLite database: the original WDBC training split
plus any cases a doctor has reviewed in the app. The WDBC test split stays fixed
and is held back until the grid search is complete. The tuned pipeline is saved
as evaluated, without fitting it again on the held-out records.

Run it by hand with `python train_model.py` from the project folder. The server
(server.py) also calls `train_and_save()` to retrain after each doctor review.

Steps in `train_and_save()`:
  1. Check the quality of the original dataset (for the report only).
  2. Load the training and test records from the database.
  3. Tune Logistic Regression's C setting with 5-fold cross-validation.
  4. Score the tuned model once on the test records.
  5. Save the model, a new version row in the database, plots, and reports.
"""

from __future__ import annotations

import json
import os
import platform
from importlib.metadata import version
from pathlib import Path

import joblib
import matplotlib

# Draw plots straight to image files without opening a window (needed on the server too).
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.datasets import load_breast_cancer
from sklearn.metrics import (
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    make_scorer,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

import database
from database import DATASET_NAME, FEATURE_KEYS, FEATURE_NAMES, SEED, TARGET_NAMES, TEST_SIZE


# Files this script writes. The paths are relative to the project folder, so run it from there.
OUTPUT_DIR = Path("models")
MODEL_PATH = OUTPUT_DIR / "breast_cancer_model.joblib"
EVIDENCE_PATH = OUTPUT_DIR / "model_evidence.json"
QUALITY_PATH = OUTPUT_DIR / "data_quality_report.json"
ROC_PLOT_PATH = OUTPUT_DIR / "roc_curve.png"
CONFUSION_PLOT_PATH = OUTPUT_DIR / "confusion_matrix.png"
TRAINING_DATA_PATH = Path("training_data.json")
TESTING_DATA_PATH = Path("testing_data.json")
DEMO_PATH = Path("demo_cases.json")

# Shown in the app header and in the reports.
MODEL_NAME = "Logistic Regression"


def inspect_data_quality(X, y, feature_names, target_names) -> dict:
    """Summarize missingness, numeric validity, duplicates, constants, and ranges."""
    frame = pd.DataFrame(X, columns=feature_names)
    # One summary per measurement: type, gaps, number of distinct values, and range.
    feature_summaries = []
    for feature_name in feature_names:
        column = frame[feature_name]
        feature_summaries.append({
            "name": str(feature_name),
            "dtype": str(column.dtype),
            "missing_values": int(column.isna().sum()),
            "unique_values": int(column.nunique(dropna=True)),
            "minimum": float(column.min()),
            "maximum": float(column.max()),
            "constant": bool(column.nunique(dropna=True) <= 1),
        })

    # How many records are benign and how many are malignant.
    class_counts = {
        str(class_name): int(np.count_nonzero(y == label))
        for label, class_name in enumerate(target_names)
    }
    # Dataset-wide checks. Anything missing, infinite, duplicated, or constant would need fixing before training.
    row_count = int(len(y))
    return {
        "source": "scikit-learn bundled load_breast_cancer dataset (Wisconsin Diagnostic Breast Cancer)",
        "rows": row_count,
        "feature_count": int(X.shape[1]),
        "all_features_numeric": bool(all(pd.api.types.is_numeric_dtype(frame[name]) for name in feature_names)),
        "missing_value_count": int(frame.isna().sum().sum()),
        "infinite_value_count": int(np.count_nonzero(np.isinf(X))),
        "duplicate_feature_rows": int(frame.duplicated().sum()),
        "constant_features": [item["name"] for item in feature_summaries if item["constant"]],
        "class_distribution": {
            name: {"count": count, "percentage": round(count / row_count * 100, 2)}
            for name, count in class_counts.items()
        },
        "features": feature_summaries,
    }


def make_model_and_grid():
    """Return the Logistic Regression pipeline and its parameter grid."""
    # A pipeline runs its steps in order. StandardScaler puts every measurement on the same scale
    # (mean 0, spread 1) so large values such as area don't outweigh small ones such as smoothness.
    # Because the scaler is inside the pipeline, it only learns from the training folds during cross-validation.
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(solver="lbfgs", max_iter=1000, random_state=SEED)),
    ])
    # Values of C to try. C controls regularization: a small C keeps the model simple, a large C lets
    # it fit the training data more closely. The "classifier__" prefix applies the setting to that pipeline step.
    parameter_grid = {
        "classifier__C": [0.01, 0.1, 1, 10, 100],
    }
    return pipeline, parameter_grid


def build_cv_records(search: GridSearchCV) -> list[dict]:
    """Flatten every parameter combination and all requested CV metrics."""
    # GridSearchCV stores its results as columns; turn them into one row per C value.
    results = search.cv_results_
    records = []
    for index, params in enumerate(results["params"]):
        records.append({
            "parameters": params,
            "mean_roc_auc": float(results["mean_test_roc_auc"][index]),
            "std_roc_auc": float(results["std_test_roc_auc"][index]),
            "mean_recall": float(results["mean_test_recall"][index]),
            "std_recall": float(results["std_test_recall"][index]),
            "mean_precision": float(results["mean_test_precision"][index]),
            "std_precision": float(results["std_test_precision"][index]),
            "mean_f1": float(results["mean_test_f1"][index]),
            "std_f1": float(results["std_test_f1"][index]),
            "mean_accuracy": float(results["mean_test_accuracy"][index]),
            "std_accuracy": float(results["std_test_accuracy"][index]),
            "rank_roc_auc": int(results["rank_test_roc_auc"][index]),
        })
    return records


def evaluate_test_set(estimator, X_test, y_test, malignant_label: int, benign_label: int) -> dict:
    """Score the model on the held-out test records, with malignant as the positive class.

    Also returns the raw scores and predictions, which the plots need but the JSON reports leave out.
    """
    predictions = estimator.predict(X_test)
    class_labels = [int(label) for label in estimator.classes_]
    # Find which column of predict_proba holds the probability of malignancy.
    malignant_index = class_labels.index(malignant_label)
    malignant_scores = estimator.predict_proba(X_test)[:, malignant_index]
    malignant_truth = (y_test == malignant_label).astype(int)
    # Rows are the actual class and columns the predicted class, malignant first:
    # [[cancers caught, cancers missed], [false alarms, benign correctly cleared]].
    matrix = confusion_matrix(y_test, predictions, labels=[malignant_label, benign_label])
    return {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(precision_score(y_test, predictions, pos_label=malignant_label, zero_division=0)),
        "recall": float(recall_score(y_test, predictions, pos_label=malignant_label, zero_division=0)),
        "f1": float(f1_score(y_test, predictions, pos_label=malignant_label, zero_division=0)),
        "roc_auc": float(roc_auc_score(malignant_truth, malignant_scores)),
        "confusion_matrix_labels": ["malignant", "benign"],
        "confusion_matrix": matrix.tolist(),
        "malignant_scores": malignant_scores,
        "malignant_truth": malignant_truth,
        "predictions": predictions,
    }


def save_plots(results: dict) -> None:
    """Save the ROC curve and confusion matrix images for the test-set results."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # ROC curve: cancers caught against false alarms at every possible cut-off. The dashed line is guessing.
    fig, axis = plt.subplots(figsize=(8, 7))
    false_positive_rate, true_positive_rate, _ = roc_curve(
        results["malignant_truth"], results["malignant_scores"]
    )
    curve_auc = auc(false_positive_rate, true_positive_rate)
    axis.plot(false_positive_rate, true_positive_rate, linewidth=2,
              label=f"{MODEL_NAME} (AUC = {curve_auc:.3f})")
    axis.plot([0, 1], [0, 1], "--", color="#777777", linewidth=1, label="Chance")
    axis.set(title="ROC curve (malignant is positive)", xlabel="False positive rate", ylabel="True positive rate")
    axis.legend(loc="lower right")
    axis.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(ROC_PLOT_PATH, dpi=160)
    plt.close(fig)

    # Confusion matrix: a 2x2 grid counting the right and wrong predictions for each class.
    fig, axis = plt.subplots(figsize=(5.5, 4.8))
    matrix = np.asarray(results["confusion_matrix"])
    axis.imshow(matrix, cmap="Blues")
    axis.set(title=f"{MODEL_NAME} confusion matrix", xticks=[0, 1], yticks=[0, 1],
             xticklabels=["Malignant", "Benign"], yticklabels=["Malignant", "Benign"],
             xlabel="Predicted", ylabel="Actual")
    for row in range(2):
        for column in range(2):
            axis.text(column, row, str(matrix[row, column]), ha="center", va="center", color="#162b4d")
    fig.tight_layout()
    fig.savefig(CONFUSION_PLOT_PATH, dpi=160)
    plt.close(fig)


def write_dataset_files(connection) -> None:
    """Save the original WDBC training and test splits as JSON snapshots."""
    metadata = {
        "dataset": DATASET_NAME,
        "target_names": TARGET_NAMES,
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
    }
    # Only the original WDBC records are exported; doctor-reviewed cases stay in the database.
    for split, path in (("training", TRAINING_DATA_PATH), ("testing", TESTING_DATA_PATH)):
        rows = connection.execute(
            "SELECT * FROM records WHERE source = 'wdbc' AND split = ? ORDER BY id", (split,)
        ).fetchall()
        records = [
            {
                "source_index": int(row["source_index"]),
                "features": {name: float(row[key]) for name, key in zip(FEATURE_NAMES, FEATURE_KEYS)},
                "target": row["label"],
            }
            for row in rows
        ]
        snapshot = {**metadata, "set": split, "records": records}
        path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")


def write_demo_cases(X_test, y_test, malignant_label, benign_label, estimator) -> None:
    """Save six held-out test records (the first 3 benign and 3 malignant) for the app's demo button."""
    rows = []
    for label in (benign_label, malignant_label):
        matching = np.flatnonzero(y_test == label)[:3]
        for row_index in matching:
            rows.append((X_test[row_index], int(label)))
    if len(rows) != 6:
        raise RuntimeError("The held-out test set must contain at least three examples of each class.")
    # Store each case's real label and the current model's answer for it.
    demo_cases = []
    for values, label in rows:
        row_prediction = int(estimator.predict([values])[0])
        classes = [int(class_label) for class_label in estimator.classes_]
        malignant_probability = float(
            estimator.predict_proba([values])[0][classes.index(malignant_label)]
        )
        demo_cases.append({
            "features": {name: float(value) for name, value in zip(FEATURE_NAMES, values)},
            "true_label": TARGET_NAMES[label],
            "model_prediction": TARGET_NAMES[row_prediction],
            "model_malignant_probability": malignant_probability,
        })
    DEMO_PATH.write_text(json.dumps(demo_cases, indent=2) + "\n", encoding="utf-8")


def train_and_save(verbose: bool = False) -> dict:
    """Train on the database's training split, evaluate on its test split, and save a new model version."""
    # 1. Check the original dataset's quality. This is for the report only; nothing is changed.
    dataset = load_breast_cancer()
    data_quality = inspect_data_quality(dataset.data, dataset.target, FEATURE_NAMES, TARGET_NAMES)
    if verbose:
        print("Dataset quality inspection (WDBC dataset before splitting):")
        print(json.dumps({key: value for key, value in data_quality.items() if key != "features"}, indent=2))
        print("Feature ranges and unique-value counts:")
        print(pd.DataFrame(data_quality["features"]).to_string(index=False))

    # 2. Load the training records (WDBC + doctor reviews) and the fixed test records.
    with database.connect() as connection:
        X_train, train_labels, train_sources = database.fetch_split(connection, "training")
        X_test, test_labels, _ = database.fetch_split(connection, "testing")
    # The model works with numbers, so turn the labels into 0 (malignant) and 1 (benign).
    label_ids = {name: index for index, name in enumerate(TARGET_NAMES)}
    y_train = np.array([label_ids[name] for name in train_labels])
    y_test = np.array([label_ids[name] for name in test_labels])
    malignant_label = label_ids["malignant"]
    benign_label = label_ids["benign"]
    review_records = sum(1 for source in train_sources if source == "review")

    # 3. Define how each C value is scored during cross-validation. Malignant is the positive
    # class throughout, because catching cancers is what matters most. This custom scorer
    # computes ROC-AUC from the probability of malignancy.
    def malignant_roc_auc(estimator, features, labels):
        classes = [int(label) for label in estimator.classes_]
        probabilities = estimator.predict_proba(features)[:, classes.index(malignant_label)]
        return roc_auc_score((labels == malignant_label).astype(int), probabilities)

    scoring = {
        "roc_auc": malignant_roc_auc,
        "recall": make_scorer(recall_score, pos_label=malignant_label, zero_division=0),
        "precision": make_scorer(precision_score, pos_label=malignant_label, zero_division=0),
        "f1": make_scorer(f1_score, pos_label=malignant_label, zero_division=0),
        "accuracy": "accuracy",
    }

    # 4. Tune C with 5-fold cross-validation on the training records only. Each fold keeps the
    # benign/malignant mix. The C with the best mean ROC-AUC (refit="roc_auc") is then fit
    # again on all the training records.
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    pipeline, parameter_grid = make_model_and_grid()
    if verbose:
        print(f"Tuning {MODEL_NAME} on {len(y_train)} training records ({review_records} from doctor reviews)...")
    search = GridSearchCV(
        estimator=pipeline,
        param_grid=parameter_grid,
        scoring=scoring,
        refit="roc_auc",
        cv=folds,
        n_jobs=-1,
        return_train_score=False,
        error_score="raise",
    )
    search.fit(X_train, y_train)
    # Scores for every C tried, and for the winning one.
    cv_records = build_cv_records(search)
    best_cv = {
        "best_parameters": search.best_params_,
        "mean_roc_auc": float(search.cv_results_["mean_test_roc_auc"][search.best_index_]),
        "mean_recall": float(search.cv_results_["mean_test_recall"][search.best_index_]),
        "mean_precision": float(search.cv_results_["mean_test_precision"][search.best_index_]),
        "mean_f1": float(search.cv_results_["mean_test_f1"][search.best_index_]),
        "mean_accuracy": float(search.cv_results_["mean_test_accuracy"][search.best_index_]),
    }
    # The tuned pipeline (scaler + Logistic Regression), already fit on all the training records.
    model = search.best_estimator_

    # 5. Score the model once on the test records, then save the plots and demo cases.
    # The holdout is first accessed here, after tuning is complete.
    evaluation = evaluate_test_set(model, X_test, y_test, malignant_label, benign_label)
    save_plots(evaluation)
    write_demo_cases(X_test, y_test, malignant_label, benign_label, model)
    # Drop the raw per-record arrays so the results can be saved as JSON.
    test_json = {
        key: value for key, value in evaluation.items()
        if key not in {"malignant_scores", "malignant_truth", "predictions"}
    }

    # 6. Build the model bundle: the model plus everything the server needs to use it. The training
    # ranges let the server warn when an input is outside what the model has seen.
    train_ranges = {
        key: {"min": float(X_train[:, column].min()), "max": float(X_train[:, column].max())}
        for column, key in enumerate(FEATURE_KEYS)
    }
    model_bundle = {
        "model": model,
        "model_name": MODEL_NAME,
        "input_features": FEATURE_NAMES,
        "input_keys": FEATURE_KEYS,
        "target_names": TARGET_NAMES,
        "positive_class": "malignant",
        "positive_class_label": malignant_label,
        "training_ranges": train_ranges,
        "dataset": DATASET_NAME,
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
        "training_records": int(len(y_train)),
        "review_records": review_records,
        "best_parameters": search.best_params_,
        "cv_metrics": best_cv,
        "test_metrics": test_json,
        "scikit_learn_version": sklearn.__version__,
    }
    # 7. Record the new version in the database and save the model file together. If saving the
    # file fails, the database row is rolled back, so the two never disagree.
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with database.connect() as connection:
        model_version = database.insert_model_version(
            connection, int(len(y_train)), review_records,
            search.best_params_["classifier__C"], best_cv["mean_roc_auc"], test_json,
        )
        model_bundle["version"] = model_version
        # Write to a temporary file first so the server never reads a half-written model.
        temporary_path = MODEL_PATH.with_suffix(".joblib.tmp")
        joblib.dump(model_bundle, temporary_path)
        os.replace(temporary_path, MODEL_PATH)
    # 8. Write the evidence report: everything about this run, for checking and reproducing it.
    evidence = {
        "dataset": DATASET_NAME,
        "model": MODEL_NAME,
        "model_version": model_version,
        "database": str(database.DATABASE_PATH.relative_to(Path(__file__).resolve().parent)),
        "data_quality": data_quality,
        "observations": int(len(y_train) + len(y_test)),
        "training_observations": int(len(y_train)),
        "training_observations_from_reviews": review_records,
        "test_observations": int(len(y_test)),
        "positive_class": "malignant",
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
        "cross_validation": {
            "folds": 5,
            "shuffle": True,
            "random_state": SEED,
            "refit_metric": "ROC-AUC (malignant positive)",
        },
        "all_cv_parameter_combinations": cv_records,
        "best_cv_results": best_cv,
        "test_results": test_json,
        "saved_model": str(MODEL_PATH),
        "data_quality_report": str(QUALITY_PATH),
        "plots": {"roc_curve": str(ROC_PLOT_PATH), "confusion_matrix": str(CONFUSION_PLOT_PATH)},
        "demo_cases": str(DEMO_PATH),
        "training_data": str(TRAINING_DATA_PATH),
        "testing_data": str(TESTING_DATA_PATH),
        "library_versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "streamlit": version("streamlit"),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "joblib": joblib.__version__,
            "matplotlib": matplotlib.__version__,
        },
        "warning": "Educational prototype results on a small public dataset do not establish clinical performance.",
    }
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    QUALITY_PATH.write_text(json.dumps(data_quality, indent=2) + "\n", encoding="utf-8")

    # When the server retrains, stop here. The printout below is only for running the script by hand.
    if not verbose:
        return model_bundle

    cv_frame = pd.DataFrame(cv_records)
    print("\nFull cross-validation results (all grid combinations):")
    print(cv_frame.to_string(index=False))
    print(f"\nBest CV metrics and parameters for {MODEL_NAME}:")
    print(pd.Series(best_cv).to_string())
    print("\nTest-set results (malignant positive):")
    print(pd.Series({key: value for key, value in test_json.items() if not key.startswith("confusion")}).to_string())
    print("\nConfusion matrix (actual/predicted; malignant, benign):")
    print(np.asarray(test_json["confusion_matrix"]))
    print(f"Model bundle: {MODEL_PATH}")
    print(f"Evidence JSON: {EVIDENCE_PATH}")
    print(f"Dataset quality report: {QUALITY_PATH}")
    print(f"ROC curve: {ROC_PLOT_PATH}")
    print(f"Confusion matrix: {CONFUSION_PLOT_PATH}")
    print(f"Demo cases from held-out test rows: {DEMO_PATH}")
    print(f"Model version: {model_version}")
    print("WARNING: This educational model is not clinically validated.")
    return model_bundle


def main() -> None:
    """Set up the database (first run only), export the original split as JSON, and train a model."""
    database.init_db()
    if database.seed_wdbc_records():
        print(f"Seeded {database.DATABASE_PATH} with the WDBC training and test split.")
    with database.connect() as connection:
        write_dataset_files(connection)
    train_and_save(verbose=True)


if __name__ == "__main__":
    main()
    