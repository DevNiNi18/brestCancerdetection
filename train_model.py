"""Train and evaluate a Random Forest on scikit-learn's bundled WDBC dataset.

This script is for development and education. The resulting model is not
clinically validated and must not be used to guide patient care.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


def app_input_key(dataset_feature_name: str) -> str:
    """Map a scikit-learn WDBC feature name to the Streamlit form key."""
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a Random Forest using scikit-learn's bundled WDBC dataset."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("models/breast_cancer_random_forest.joblib"),
        help="Path where the trained model bundle will be saved.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of observations reserved for a stratified holdout evaluation (default: 0.2).",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Seed used for reproducible splitting and model training (default: 42).",
    )
    parser.add_argument(
        "--n-estimators",
        type=int,
        default=400,
        help="Number of trees in each Random Forest (default: 400).",
    )
    args = parser.parse_args()

    if not 0.1 <= args.test_size <= 0.5:
        parser.error("--test-size must be between 0.1 and 0.5")
    if args.n_estimators < 1:
        parser.error("--n-estimators must be at least 1")

    return args


def main() -> None:
    args = parse_args()
    dataset = load_breast_cancer()
    X = dataset.data
    y = dataset.target

    # In scikit-learn's bundled dataset: 0 is malignant and 1 is benign.
    malignant_label = int(np.flatnonzero(dataset.target_names == "malignant")[0])
    benign_label = int(np.flatnonzero(dataset.target_names == "benign")[0])
    class_order = [malignant_label, benign_label]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    evaluation_model = RandomForestClassifier(
        n_estimators=args.n_estimators,
        class_weight="balanced",
        random_state=args.random_state,
        n_jobs=-1,
    )
    evaluation_model.fit(X_train, y_train)
    predictions = evaluation_model.predict(X_test)
    class_indices = list(evaluation_model.classes_)
    malignant_probability = evaluation_model.predict_proba(X_test)[:, class_indices.index(malignant_label)]
    malignant_truth = (y_test == malignant_label).astype(int)

    report = classification_report(
        y_test,
        predictions,
        labels=class_order,
        target_names=["malignant", "benign"],
        output_dict=True,
        zero_division=0,
    )
    matrix = confusion_matrix(y_test, predictions, labels=class_order)
    metrics = {
        "dataset": "scikit-learn load_breast_cancer (Wisconsin Diagnostic Breast Cancer)",
        "observations": int(len(y)),
        "training_observations": int(len(y_train)),
        "holdout_observations": int(len(y_test)),
        "random_state": args.random_state,
        "n_estimators": args.n_estimators,
        "positive_class": "malignant",
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "malignant_precision": float(precision_score(y_test, predictions, pos_label=malignant_label, zero_division=0)),
        "malignant_recall_sensitivity": float(recall_score(y_test, predictions, pos_label=malignant_label, zero_division=0)),
        "benign_recall_specificity": float(recall_score(y_test, predictions, pos_label=benign_label, zero_division=0)),
        "malignant_roc_auc": float(roc_auc_score(malignant_truth, malignant_probability)),
        "confusion_matrix_labels": ["malignant", "benign"],
        "confusion_matrix": matrix.tolist(),
        "classification_report": report,
        "scikit_learn_version": sklearn.__version__,
        "warning": "Holdout metrics on a small public dataset are educational and do not establish clinical performance.",
    }

    # Evaluate on held-out data, then fit the saved model on all available cases.
    final_model = RandomForestClassifier(
        n_estimators=args.n_estimators,
        class_weight="balanced",
        random_state=args.random_state,
        n_jobs=-1,
    )
    final_model.fit(X, y)

    feature_names = list(dataset.feature_names)
    bundle = {
        "model": final_model,
        "input_features": feature_names,
        "input_keys": [app_input_key(name) for name in feature_names],
        "target_names": list(dataset.target_names),
        "positive_class": "malignant",
        "dataset": metrics["dataset"],
        "scikit_learn_version": sklearn.__version__,
        "evaluation": metrics,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, args.output)
    metrics_path = args.output.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    print("Random Forest training complete.")
    print(f"Dataset: {metrics['dataset']}")
    print(f"Holdout accuracy: {metrics['accuracy']:.3f}")
    print(f"Balanced accuracy: {metrics['balanced_accuracy']:.3f}")
    print(f"Malignant sensitivity: {metrics['malignant_recall_sensitivity']:.3f}")
    print(f"Benign specificity: {metrics['benign_recall_specificity']:.3f}")
    print(f"Malignant ROC AUC: {metrics['malignant_roc_auc']:.3f}")
    print("Confusion matrix (rows: actual, columns: predicted; malignant, benign):")
    print(matrix)
    print(f"Model bundle: {args.output}")
    print(f"Evaluation metrics: {metrics_path}")
    print("WARNING: This educational model is not clinically validated.")


if __name__ == "__main__":
    main()
