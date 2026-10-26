"""Tune, compare, and save the specified WDBC breast-cancer classifiers.

The test split is held back until every grid search and the model-selection rule
are complete. The selected tuned pipeline is saved as evaluated, without fitting
it again on the held-out records or the full dataset.
"""

from __future__ import annotations

import json
import platform
from importlib.metadata import version
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import RandomForestClassifier
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
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression


SEED = 42
TEST_SIZE = 0.20
OUTPUT_DIR = Path("models")
MODEL_PATH = OUTPUT_DIR / "breast_cancer_model.joblib"
EVIDENCE_PATH = OUTPUT_DIR / "model_evidence.json"
QUALITY_PATH = OUTPUT_DIR / "data_quality_report.json"
ROC_PLOT_PATH = OUTPUT_DIR / "roc_curves.png"
CONFUSION_PLOT_PATH = OUTPUT_DIR / "confusion_matrices.png"
TRAINING_DATA_PATH = Path("training_data.json")
TESTING_DATA_PATH = Path("testing_data.json")
DEMO_PATH = Path("demo_cases.json")

MODEL_ORDER = {"Logistic Regression": 0, "SVM": 1, "Random Forest": 2}


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


def inspect_data_quality(X, y, feature_names, target_names) -> dict:
    """Summarize missingness, numeric validity, duplicates, constants, and ranges."""
    frame = pd.DataFrame(X, columns=feature_names)
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

    class_counts = {
        str(class_name): int(np.count_nonzero(y == label))
        for label, class_name in enumerate(target_names)
    }
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


def make_models_and_grids():
    """Return only the three models and parameter grids required by the brief."""
    models = {
        "Logistic Regression": (
            Pipeline([
                ("scaler", StandardScaler()),
                ("classifier", LogisticRegression(solver="lbfgs", max_iter=1000, random_state=SEED)),
            ]),
            {
                "classifier__C": [0.01, 0.1, 1, 10, 100],
            },
        ),
        "SVM": (
            Pipeline([
                ("scaler", StandardScaler()),
                ("classifier", SVC(probability=True, random_state=SEED)),
            ]),
            {
                "classifier__kernel": ["linear", "rbf"],
                "classifier__C": [0.1, 1, 10, 100],
                "classifier__gamma": ["scale", 0.01, 0.001],
            },
        ),
        "Random Forest": (
            RandomForestClassifier(random_state=SEED, n_jobs=-1),
            {
                "n_estimators": [100, 200, 300],
                "max_depth": [None, 5, 10],
                "min_samples_split": [2, 5],
            },
        ),
    }
    return models


def build_cv_records(model_name: str, search: GridSearchCV) -> list[dict]:
    """Flatten every parameter combination and all requested CV metrics."""
    results = search.cv_results_
    records = []
    for index, params in enumerate(results["params"]):
        records.append({
            "model": model_name,
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
    predictions = estimator.predict(X_test)
    class_labels = [int(label) for label in estimator.classes_]
    malignant_index = class_labels.index(malignant_label)
    malignant_scores = estimator.predict_proba(X_test)[:, malignant_index]
    malignant_truth = (y_test == malignant_label).astype(int)
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


def save_comparison_plots(evaluations: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fig, axis = plt.subplots(figsize=(8, 7))
    for model_name, results in evaluations.items():
        false_positive_rate, true_positive_rate, _ = roc_curve(
            results["malignant_truth"], results["malignant_scores"]
        )
        curve_auc = auc(false_positive_rate, true_positive_rate)
        axis.plot(false_positive_rate, true_positive_rate, linewidth=2,
                  label=f"{model_name} (AUC = {curve_auc:.3f})")
    axis.plot([0, 1], [0, 1], "--", color="#777777", linewidth=1, label="Chance")
    axis.set(title="ROC curves (malignant is positive)", xlabel="False positive rate", ylabel="True positive rate")
    axis.legend(loc="lower right")
    axis.grid(alpha=0.2)
    fig.tight_layout()
    fig.savefig(ROC_PLOT_PATH, dpi=160)
    plt.close(fig)

    fig, axes = plt.subplots(1, len(evaluations), figsize=(15, 4.8))
    for axis, (model_name, results) in zip(axes, evaluations.items()):
        matrix = np.asarray(results["confusion_matrix"])
        axis.imshow(matrix, cmap="Blues")
        axis.set(title=model_name, xticks=[0, 1], yticks=[0, 1],
                 xticklabels=["Malignant", "Benign"], yticklabels=["Malignant", "Benign"],
                 xlabel="Predicted", ylabel="Actual")
        for row in range(2):
            for column in range(2):
                axis.text(column, row, str(matrix[row, column]), ha="center", va="center", color="#162b4d")
    fig.suptitle("Confusion matrices (malignant first)")
    fig.tight_layout()
    fig.savefig(CONFUSION_PLOT_PATH, dpi=160)
    plt.close(fig)


def write_dataset_files(dataset, train_indices, test_indices) -> None:
    """Save the deterministic training and test sets as separate JSON files."""
    def records(indices):
        return [
            {
                "source_index": int(index),
                "features": {
                    str(name): float(value)
                    for name, value in zip(dataset.feature_names, dataset.data[index])
                },
                "target": str(dataset.target_names[dataset.target[index]]),
            }
            for index in indices
        ]

    metadata = {
        "dataset": "scikit-learn load_breast_cancer (Wisconsin Diagnostic Breast Cancer)",
        "target_names": [str(name) for name in dataset.target_names],
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
    }
    training = {**metadata, "set": "training", "records": records(train_indices)}
    testing = {**metadata, "set": "testing", "records": records(test_indices)}
    TRAINING_DATA_PATH.write_text(json.dumps(training, indent=2) + "\n", encoding="utf-8")
    TESTING_DATA_PATH.write_text(json.dumps(testing, indent=2) + "\n", encoding="utf-8")


def write_demo_cases(dataset, X_test, y_test, malignant_label, benign_label, selected_estimator) -> None:
    rows = []
    for label in (benign_label, malignant_label):
        matching = np.flatnonzero(y_test == label)[:3]
        for row_index in matching:
            rows.append((X_test[row_index], int(label)))
    if len(rows) != 6:
        raise RuntimeError("The held-out test set must contain at least three examples of each class.")
    demo_cases = []
    for values, label in rows:
        row_prediction = int(selected_estimator.predict([values])[0])
        classes = [int(class_label) for class_label in selected_estimator.classes_]
        malignant_probability = float(
            selected_estimator.predict_proba([values])[0][classes.index(malignant_label)]
        )
        demo_cases.append({
            "features": {str(name): float(value) for name, value in zip(dataset.feature_names, values)},
            "true_label": str(dataset.target_names[label]),
            "selected_model_prediction": str(dataset.target_names[row_prediction]),
            "selected_model_malignant_probability": malignant_probability,
        })
    DEMO_PATH.write_text(json.dumps(demo_cases, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    dataset = load_breast_cancer()
    X, y = dataset.data, dataset.target
    feature_names = list(dataset.feature_names)
    input_keys = [app_input_key(name) for name in feature_names]
    malignant_label = int(np.flatnonzero(dataset.target_names == "malignant")[0])
    benign_label = int(np.flatnonzero(dataset.target_names == "benign")[0])
    data_quality = inspect_data_quality(X, y, feature_names, dataset.target_names)

    print("Dataset quality inspection (performed before splitting):")
    print(json.dumps({key: value for key, value in data_quality.items() if key != "features"}, indent=2))
    print("Feature ranges and unique-value counts:")
    print(pd.DataFrame(data_quality["features"]).to_string(index=False))

    # Keep original indices so the selected demonstration cases are auditable.
    all_indices = np.arange(len(y))
    train_indices, test_indices = train_test_split(
        all_indices, test_size=TEST_SIZE, random_state=SEED, stratify=y
    )
    X_train, X_test = X[train_indices], X[test_indices]
    y_train, y_test = y[train_indices], y[test_indices]
    write_dataset_files(dataset, train_indices, test_indices)

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

    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    searches = {}
    cv_records = []
    for model_name, (pipeline, parameter_grid) in make_models_and_grids().items():
        print(f"Tuning {model_name}...")
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
        searches[model_name] = search
        cv_records.extend(build_cv_records(model_name, search))

    best_cv = {
        name: {
            "best_parameters": search.best_params_,
            "mean_roc_auc": float(search.cv_results_["mean_test_roc_auc"][search.best_index_]),
            "mean_recall": float(search.cv_results_["mean_test_recall"][search.best_index_]),
            "mean_precision": float(search.cv_results_["mean_test_precision"][search.best_index_]),
            "mean_f1": float(search.cv_results_["mean_test_f1"][search.best_index_]),
            "mean_accuracy": float(search.cv_results_["mean_test_accuracy"][search.best_index_]),
        }
        for name, search in searches.items()
    }
    best_auc = max(item["mean_roc_auc"] for item in best_cv.values())
    eligible = [
        name for name, item in best_cv.items()
        if item["mean_roc_auc"] >= best_auc - 0.01
    ]
    selected_name = sorted(
        eligible,
        key=lambda name: (
            -round(best_cv[name]["mean_recall"], 12),
            -round(best_cv[name]["mean_f1"], 12),
            MODEL_ORDER[name],
        ),
    )[0]
    selected_search = searches[selected_name]
    selection = {
        "rule": "Among models with mean CV ROC-AUC within 0.01 of the highest, maximize mean CV malignant recall; break ties by F1, then Logistic Regression, SVM, Random Forest.",
        "best_mean_cv_roc_auc": best_auc,
        "eligibility_threshold": best_auc - 0.01,
        "eligible_models": eligible,
        "selected_model": selected_name,
        "selected_best_parameters": selected_search.best_params_,
        "selected_cv_metrics": best_cv[selected_name],
    }

    # The holdout is first accessed here, after tuning and selection are complete.
    evaluations = {}
    for model_name, search in searches.items():
        results = evaluate_test_set(search.best_estimator_, X_test, y_test, malignant_label, benign_label)
        evaluations[model_name] = results

    save_comparison_plots(evaluations)
    write_demo_cases(
        dataset, X_test, y_test, malignant_label, benign_label, selected_search.best_estimator_
    )

    train_ranges = {
        key: {"min": float(X_train[:, column].min()), "max": float(X_train[:, column].max())}
        for column, key in enumerate(input_keys)
    }
    selected_model = selected_search.best_estimator_
    selected_bundle = {
        "model": selected_model,
        "model_name": selected_name,
        "input_features": feature_names,
        "input_keys": input_keys,
        "target_names": list(dataset.target_names),
        "positive_class": "malignant",
        "positive_class_label": malignant_label,
        "training_ranges": train_ranges,
        "dataset": "scikit-learn load_breast_cancer (Wisconsin Diagnostic Breast Cancer)",
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
        "best_parameters": selected_search.best_params_,
        "cv_metrics": best_cv[selected_name],
        "scikit_learn_version": sklearn.__version__,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(selected_bundle, MODEL_PATH)

    test_json = {}
    for model_name, results in evaluations.items():
        test_json[model_name] = {
            key: value for key, value in results.items()
            if key not in {"malignant_scores", "malignant_truth", "predictions"}
        }
    evidence = {
        "dataset": "scikit-learn load_breast_cancer (Wisconsin Diagnostic Breast Cancer)",
        "data_quality": data_quality,
        "observations": int(len(y)),
        "training_observations": int(len(train_indices)),
        "test_observations": int(len(test_indices)),
        "positive_class": "malignant",
        "split": {"test_size": TEST_SIZE, "random_state": SEED, "stratified": True},
        "cross_validation": {
            "folds": 5,
            "shuffle": True,
            "random_state": SEED,
            "selection_refit_metric": "ROC-AUC (malignant positive)",
        },
        "all_cv_parameter_combinations": cv_records,
        "best_cv_results_by_model": best_cv,
        "selection_decision": selection,
        "test_results": test_json,
        "saved_model": str(MODEL_PATH),
        "data_quality_report": str(QUALITY_PATH),
        "plots": {"roc_curves": str(ROC_PLOT_PATH), "confusion_matrices": str(CONFUSION_PLOT_PATH)},
        "demo_cases": str(DEMO_PATH),
        "training_data": str(TRAINING_DATA_PATH),
        "testing_data": str(TESTING_DATA_PATH),
        "demo_cases": str(DEMO_PATH),
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

    cv_frame = pd.DataFrame(cv_records)
    print("\nFull cross-validation results (all grid combinations):")
    print(cv_frame.to_string(index=False))
    print("\nBest CV metrics and parameters by model:")
    print(pd.DataFrame(best_cv).T.to_string())
    print("\nTest-set results (malignant positive):")
    print(pd.DataFrame(test_json).T.to_string())
    for model_name, results in test_json.items():
        print(f"\n{model_name} confusion matrix (actual/predicted; malignant, benign):")
        print(np.asarray(results["confusion_matrix"]))
    print(f"\nSelected model: {selected_name}")
    print(f"Selection decision: {selection}")
    print(f"Model bundle: {MODEL_PATH}")
    print(f"Evidence JSON: {EVIDENCE_PATH}")
    print(f"Dataset quality report: {QUALITY_PATH}")
    print(f"ROC curves: {ROC_PLOT_PATH}")
    print(f"Confusion matrices: {CONFUSION_PLOT_PATH}")
    print(f"Demo cases from held-out test rows: {DEMO_PATH}")
    print("WARNING: This educational model is not clinically validated.")


if __name__ == "__main__":
    main()
