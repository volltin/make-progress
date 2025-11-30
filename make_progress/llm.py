from __future__ import annotations

import json
from typing import List, Tuple

from .config import get_client, get_model_name
from .models import CompletedStep, Step
from .prompts import prompt_text, steps_schema


def llm_params(task: str, stream: bool, completed: List[CompletedStep] | None = None):
    client = get_client()
    model = get_model_name()
    completed = completed or []
    completed_lines = []
    for item in completed:
        line = (
            f"- {item.title} | subtitle: {item.subtitle} | feedback: {item.feedback_question} -> "
            f"answer: {item.feedback_answer}"
        )
        completed_lines.append(line)
    completed_summary = "\n".join(completed_lines)
    messages = [
        {"role": "system", "content": prompt_text(completed_summary)},
        {"role": "user", "content": task.strip()},
    ]
    response_format = {
        "type": "json_schema",
        "json_schema": {"name": "steps", "strict": True, "schema": steps_schema()},
    }
    return client, dict(
        model=model,
        messages=messages,
        temperature=0.4,
        response_format=response_format,
        stream=stream,
    )


def parse_steps_payload(payload: dict) -> List[Step]:
    raw_steps = payload.get("steps") if isinstance(payload, dict) else None
    if not raw_steps:
        raise ValueError("Model returned no steps")
    steps: List[Step] = []
    for item in raw_steps:
        title = (item.get("title") or "").strip() if isinstance(item, dict) else ""
        subtitle = (item.get("subtitle") or "").strip() if isinstance(item, dict) else ""
        minutes_raw = item.get("estimate_minutes") if isinstance(item, dict) else None
        feedback = (item.get("feedback_question") or "").strip() if isinstance(item, dict) else ""
        try:
            estimate = int(minutes_raw)
        except Exception:
            estimate = 0
        estimate = max(1, estimate)
        if not title or not subtitle:
            continue
        steps.append(
            Step(
                title=title,
                subtitle=subtitle,
                estimate_minutes=estimate,
                feedback_question=feedback,
            )
        )
    if not steps:
        raise ValueError("No valid steps generated from model response")
    return steps
