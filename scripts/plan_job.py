#!/usr/bin/env python3
"""Create a compact satellite job plan without calling an LLM."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "config" / "intent_rules.json"


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def load_rules() -> dict[str, Any]:
    with RULES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def score_rule(goal: str, rule: dict[str, Any]) -> tuple[int, list[str]]:
    matched = [keyword for keyword in rule.get("keywords", []) if normalize(keyword) in goal]
    return len(matched), matched


def build_plan(goal_text: str, time_text: str | None = None) -> dict[str, Any]:
    config = load_rules()
    goal = normalize(goal_text)
    ranked: list[tuple[int, dict[str, Any], list[str]]] = []

    for rule in config["rules"]:
        score, matched = score_rule(goal, rule)
        ranked.append((score, rule, matched))

    ranked.sort(key=lambda row: row[0], reverse=True)
    best_score, best_rule, matched = ranked[0]

    if best_score == 0:
        discovery = config["auto_discovery"]
        return {
            "intent": config["default_intent"],
            "confidence": 0.55,
            "needs_clarification": False,
            "goal": goal_text.strip(),
            "time": time_text or "latest useful data",
            "sources": discovery["sources"],
            "outputs": discovery["outputs"],
            "max_download_gb": discovery["max_download_gb"],
            "reason": "No specific intent matched; use a small discovery pack."
        }

    confidence = min(0.98, 0.72 + (0.08 * best_score))
    sources = [best_rule["primary"]]
    if best_rule.get("secondary"):
        sources.append(best_rule["secondary"])

    plan = {
        "intent": best_rule["intent"],
        "confidence": round(confidence, 2),
        "needs_clarification": False,
        "goal": goal_text.strip(),
        "time": time_text or "latest useful data",
        "sources": sources,
        "fallbacks": best_rule.get("fallbacks", []),
        "outputs": best_rule.get("outputs", []),
        "selection_mode": best_rule.get("selection_mode", "best_single"),
        "lookback_days": best_rule.get("lookback_days", 365),
        "matched_terms": matched
    }
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan a free satellite-data job from a plain-language goal.")
    parser.add_argument("--goal", required=True, help="What the user wants to know")
    parser.add_argument("--time", help="Optional date, range, before-after, or latest")
    parser.add_argument("--output", type=Path, help="Optional path for plan.json")
    args = parser.parse_args()

    plan = build_plan(args.goal, args.time)
    rendered = json.dumps(plan, ensure_ascii=False, separators=(",", ":"))

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
