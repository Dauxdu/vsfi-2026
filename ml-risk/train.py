"""Train a tiny risk classifier: title + location + client -> risk."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "jobs.csv"
MODEL_PATH = ROOT / "model" / "risk_model.joblib"
META_PATH = ROOT / "model" / "meta.json"

FEATURES = ["title", "location", "client"]
TARGET = "risk"


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    x = df[FEATURES]
    y = df[TARGET]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=42, stratify=y
    )

    pipeline = Pipeline(
        steps=[
            (
                "encode",
                ColumnTransformer(
                    transformers=[
                        (
                            "cat",
                            OneHotEncoder(handle_unknown="ignore"),
                            FEATURES,
                        )
                    ]
                ),
            ),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=100,
                    max_depth=12,
                    random_state=42,
                    class_weight="balanced",
                ),
            ),
        ]
    )

    pipeline.fit(x_train, y_train)
    y_pred = pipeline.predict(x_test)
    report = classification_report(y_test, y_pred, output_dict=True)
    print(classification_report(y_test, y_pred))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    meta = {
        "features": FEATURES,
        "target": TARGET,
        "classes": sorted(y.unique().tolist()),
        "model_path": str(MODEL_PATH.name),
        "accuracy": report["accuracy"],
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
    }
    META_PATH.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"saved model -> {MODEL_PATH}")
    print(f"saved meta  -> {META_PATH}")


if __name__ == "__main__":
    main()
