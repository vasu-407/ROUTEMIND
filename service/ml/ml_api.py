"""
ML Prediction Microservice
FastAPI service (port 8001) exposing POST /predict
Used by the OR-Tools optimization engine.
"""
import json
import os
import sys
from typing import List

import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.feature_engineering import FEATURE_COLS

app = FastAPI(title="RouteMind ML Prediction Service", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = os.path.dirname(__file__)
_model = None


def get_model() -> xgb.XGBRegressor:
    global _model
    if _model is None:
        model_path = os.path.join(MODEL_DIR, "model.json")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                "model.json not found. Run `python ml/train_xgboost.py` first."
            )
        _model = xgb.XGBRegressor()
        _model.load_model(model_path)
    return _model


class StopFeatures(BaseModel):
    distance_km: float
    departure_hour: int
    num_stops: int
    load_ratio: float
    service_time_sec: float
    stop_volume_cm3: float
    num_packages: int
    zone_id: int
    stop_density: float
    executor_capacity_cm3: float


class PredictRequest(BaseModel):
    stops: List[StopFeatures]


class PredictResponse(BaseModel):
    predicted_travel_times_sec: List[float]
    model_version: str = "xgboost-v1"


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        model = get_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    import pandas as pd
    rows = [s.model_dump() for s in request.stops]
    df = pd.DataFrame(rows)[FEATURE_COLS]
    preds = model.predict(df).tolist()

    return PredictResponse(predicted_travel_times_sec=[round(p, 2) for p in preds])


@app.get("/metrics")
def get_metrics():
    metrics_path = os.path.join(MODEL_DIR, "metrics.json")
    importance_path = os.path.join(MODEL_DIR, "feature_importance.json")

    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Model not trained yet.")

    with open(metrics_path) as f:
        metrics = json.load(f)
    with open(importance_path) as f:
        importance = json.load(f)

    return {"metrics": metrics, "feature_importance": importance}


@app.get("/health")
def health():
    model_ready = os.path.exists(os.path.join(MODEL_DIR, "model.json"))
    return {"status": "ok", "model_ready": model_ready}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
