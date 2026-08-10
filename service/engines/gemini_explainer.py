"""Gemini explainability — narrative only; never optimizes routes."""
import json
from typing import Any, Dict, List, Optional

from core.config import GEMINI_API_KEY


class GeminiExplainer:
    def explain(
        self,
        metrics: dict,
        violations: List[Any],
        route_label: str = "",
        event: Optional[str] = None,
        context: Optional[dict] = None,
    ) -> dict:
        structured = {
            "route_label": route_label,
            "metrics": metrics,
            "violations": violations,
            "event": event,
            "context": context or {},
        }
        if not GEMINI_API_KEY:
            return None

        try:
            import google.generativeai as genai

            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            
            if context and "question" in context:
                prompt = (
                    "You are an AI Copilot for Amazon Transportation Services. "
                    "Answer the supervisor's question using the provided context. "
                    "Return JSON with exactly two keys: 'answer' (string) and 'suggested_actions' (list of strings).\n\n"
                    f"Data:\n{json.dumps(structured, default=str)}"
                )
            else:
                prompt = (
                    "You are a logistics supervisor assistant. Explain why a delivery route changed. "
                    "Do NOT suggest a new route order or optimization steps. "
                    "Return JSON with exactly these keys: reason_changed, business_impact, constraint_triggered (array of strings), "
                    "fuel_impact_inr (number), eta_impact_mins (number), supervisor_recommendation, recommended_action "
                    "(one of approve, reject, review), driver_notification, confidence_score (0-1).\n\n"
                    f"Data:\n{json.dumps(structured, default=str)}"
                )
            
            resp = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(resp.text)
        except Exception as exc:
            print(f"Gemini explain failed: {exc}")
            return None
