"""
XGBoost Training Pipeline
Trains a regression model to predict segment travel times.
Outputs: ml/model.json, ml/metrics.json, ml/feature_importance.json
"""
import json
import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.feature_engineering import (
    load_raw_data, build_features, FEATURE_COLS, TARGET_COL, BASE_DIR
)

MODEL_DIR = os.path.join(os.path.dirname(__file__))


def train():
    # ── 1. Load or generate features ───────────────────────────────────────
    features_path = os.path.join(MODEL_DIR, "features.csv")
    if os.path.exists(features_path):
        print("Loading pre-computed features from features.csv...")
        df = pd.read_csv(features_path)
    else:
        print("Generating features from raw dataset...")
        route_data, package_data, actual_sequences = load_raw_data(BASE_DIR)
        df = build_features(route_data, package_data, actual_sequences, max_routes=200)
        df.to_csv(features_path, index=False)

    print(f"Dataset: {len(df)} rows, {len(FEATURE_COLS)} features")

    # ── 2. Prepare X, y ────────────────────────────────────────────────────
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # ── 3. Train XGBoost ───────────────────────────────────────────────────
    print("Training XGBoost model...")
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbosity=0
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    # ── 4. Evaluate ────────────────────────────────────────────────────────
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)

    metrics = {
        "mae_seconds": round(mae, 2),
        "rmse_seconds": round(rmse, 2),
        "r2_score": round(r2, 4),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features": FEATURE_COLS
    }

    print("\n--- XGBoost Metrics ---")
    print(f"  MAE  : {mae:.1f} seconds")
    print(f"  RMSE : {rmse:.1f} seconds")
    print(f"  R2   : {r2:.4f}")
    print("----------------------\n")

    # ── 5. Feature Importance ──────────────────────────────────────────────
    # -- 5. Feature Importance ----------------------------------------------
    importance = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    importance_sorted = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    # -- 6. Save artifacts --------------------------------------------------
    model_path = os.path.join(MODEL_DIR, "model.json")
    model.save_model(model_path)
    print(f"Model saved -> {model_path}")

    with open(os.path.join(MODEL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    with open(os.path.join(MODEL_DIR, "feature_importance.json"), "w") as f:
        json.dump(importance_sorted, f, indent=2)

    print("metrics.json and feature_importance.json saved.")
    return model, metrics, importance_sorted


if __name__ == "__main__":
    train()
