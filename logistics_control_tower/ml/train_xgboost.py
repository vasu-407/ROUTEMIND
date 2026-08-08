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


def train(trials: int = 5):
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

    # Hold out complete routes so validation does not leak neighbouring stops
    # from a route into both the train and validation sets.
    route_ids = df["route_id"].unique()
    train_routes, test_routes = train_test_split(route_ids, test_size=0.2, random_state=42)
    train_mask = df["route_id"].isin(train_routes)
    X_train, X_test = X.loc[train_mask], X.loc[~train_mask]
    y_train, y_test = y.loc[train_mask], y.loc[~train_mask]

    # ── 3. Train XGBoost ───────────────────────────────────────────────────
    candidates = [
        {"n_estimators": 300, "max_depth": 5, "learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "random_state": 11},
        {"n_estimators": 450, "max_depth": 6, "learning_rate": 0.035, "subsample": 0.85, "colsample_bytree": 0.9, "random_state": 23},
        {"n_estimators": 550, "max_depth": 4, "learning_rate": 0.04, "subsample": 0.9, "colsample_bytree": 0.85, "random_state": 37},
        {"n_estimators": 350, "max_depth": 7, "learning_rate": 0.03, "subsample": 0.8, "colsample_bytree": 0.75, "random_state": 53},
        {"n_estimators": 500, "max_depth": 5, "learning_rate": 0.03, "subsample": 0.9, "colsample_bytree": 0.9, "random_state": 71},
    ][:trials]
    results = []
    best_model = None
    best_mae = float("inf")
    for index, params in enumerate(candidates, start=1):
        print(f"Training candidate {index}/{len(candidates)}...")
        model = xgb.XGBRegressor(**params, n_jobs=-1, verbosity=0, objective="reg:squarederror", tree_method="hist")
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        preds = model.predict(X_test)
        mae = mean_absolute_error(y_test, preds)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        r2 = r2_score(y_test, preds)
        results.append({"trial": index, "mae_seconds": round(mae, 2), "rmse_seconds": round(rmse, 2), "r2_score": round(r2, 4), "params": params})
        print(f"  MAE: {mae:.2f} seconds")
        if mae < best_mae:
            best_mae, best_model = mae, model

    model = best_model
    best_result = min(results, key=lambda item: item["mae_seconds"])
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)

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
        "validation_routes": len(test_routes),
        "features": FEATURE_COLS,
        "selection_metric": "mae_seconds",
        "best_trial": best_result,
        "all_trials": results,
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
