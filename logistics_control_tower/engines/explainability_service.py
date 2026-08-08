from typing import List, Optional

from engines.explainability import ExplainabilityEngine
from engines.gemini_explainer import GeminiExplainer


class ExplainabilityService:
    def __init__(self):
        self.rules = ExplainabilityEngine()
        self.gemini = GeminiExplainer()

    def generate(self, metrics: dict, violations: list, route_label: str = "", event=None, context=None) -> dict:
        base = self.rules.generate_explanation(metrics, violations, event=event)
        if route_label:
            base["route_label"] = route_label
        gemini = self.gemini.explain(metrics, violations, route_label, event, context)
        if gemini:
            # Gemini enriches the narrative; deterministic fields remain as
            # fallbacks so the approval workflow is never dependent on an LLM.
            base.update({key: value for key, value in gemini.items() if value is not None})
            base["ai_provider"] = "gemini"
            return base
        base["ai_provider"] = "rules"
        return base
