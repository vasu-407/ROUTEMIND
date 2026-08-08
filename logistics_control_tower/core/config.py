"""Central configuration — dataset paths and service URLs."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_DATA = _REPO_ROOT / "almrrc2021-data-training" / "model_build_inputs"
_LEGACY_DATA = Path("c:/amazon-last-mile/almrrc2021-data-training/model_build_inputs")

if _DEFAULT_DATA.exists():
    _FALLBACK = str(_DEFAULT_DATA)
elif _LEGACY_DATA.exists():
    _FALLBACK = str(_LEGACY_DATA)
else:
    _FALLBACK = str(_DEFAULT_DATA)

DATA_DIR = os.environ.get("ROUTEMIND_DATA_DIR", _FALLBACK)
ML_API_URL = os.environ.get("ML_API_URL", "http://127.0.0.1:8001")
USE_ML_TRAVEL_TIMES = os.environ.get("ROUTEMIND_USE_ML_TRAVEL_TIMES", "true").lower() == "true"
MAX_PICKUP_DISTANCE_IMPACT_KM = float(os.environ.get("ROUTEMIND_MAX_PICKUP_DISTANCE_KM", "5"))
MAX_PICKUP_TIME_IMPACT_MINS = float(os.environ.get("ROUTEMIND_MAX_PICKUP_TIME_MINS", "15"))
MAX_ROUTES_LOAD = int(os.environ.get("ROUTEMIND_MAX_ROUTES", "100"))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
