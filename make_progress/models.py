from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class PlanRequest(BaseModel):
    task: str
    completed: Optional[List["CompletedStep"]] = None


class Step(BaseModel):
    title: str
    subtitle: str
    estimate_minutes: int
    feedback_question: str


class CompletedStep(BaseModel):
    title: str
    subtitle: str
    estimate_minutes: int
    feedback_question: str
    feedback_answer: str


class PlanResponse(BaseModel):
    task: str
    steps: List[Step]
