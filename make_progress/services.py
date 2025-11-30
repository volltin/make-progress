import asyncio
import json
import logging
from typing import List

from .llm import llm_params, parse_steps_payload
from .models import CompletedStep, Step

logger = logging.getLogger("make-progress")


def generate_steps(task: str, completed: List[CompletedStep] | None = None) -> List[Step]:
    client, params = llm_params(task, stream=False, completed=completed)
    completion = client.chat.completions.create(**params)
    content = completion.choices[0].message.content or ""
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model returned invalid JSON: {exc}") from exc
    steps = parse_steps_payload(parsed)
    logger.info("Generated %d steps for task '%s'", len(steps), task)
    return steps


def stream_steps(task: str, completed: List[CompletedStep] | None = None):
    client, params = llm_params(task, stream=True, completed=completed)

    async def event_stream():
        scan_tail = ""
        in_steps = False
        brace_depth = 0
        current_obj = ""
        step_count = 0
        yield "event: start\ndata: {}\n\n"
        try:
            stream = client.chat.completions.create(**params)
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if not delta:
                    continue
                yield f"event: token\ndata: {json.dumps({'text': delta}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)  # allow flushing
                for ch in delta:
                    scan_tail = (scan_tail + ch)[-24:]
                    if not in_steps and '"steps"' in scan_tail and ch == "[":
                        in_steps = True
                        brace_depth = 0
                        current_obj = ""
                        continue
                    if in_steps:
                        if ch == "{":
                            brace_depth += 1
                        if brace_depth > 0:
                            current_obj += ch
                        if ch == "}":
                            brace_depth -= 1
                            if brace_depth == 0 and current_obj:
                                try:
                                    parsed_json = json.loads(current_obj)
                                    title = (parsed_json.get("title") or "").strip()
                                    subtitle = (parsed_json.get("subtitle") or "").strip()
                                    feedback = (parsed_json.get("feedback_question") or "").strip()
                                    minutes_raw = parsed_json.get("estimate_minutes")
                                    estimate = int(minutes_raw)
                                except Exception:
                                    current_obj = ""
                                    continue
                                if not title or not subtitle:
                                    current_obj = ""
                                    continue
                                step_count += 1
                                payload = {
                                    "index": step_count,
                                    "title": title,
                                    "subtitle": subtitle,
                                    "feedback_question": feedback,
                                    "estimate_minutes": max(1, estimate),
                                }
                                yield f"event: step\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                                await asyncio.sleep(0.08)
                                current_obj = ""
                        if in_steps and ch == "]":
                            in_steps = False
            yield "event: end\ndata: {\"status\":\"ok\"}\n\n"
            if step_count == 0:
                raise ValueError("No steps streamed from model response")
            logger.info("Streamed %d steps for task '%s'", step_count, task)
        except Exception as exc:
            logger.exception("Server error generating steps stream: %s", exc)
            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            yield "event: done\n\n"

    return event_stream
