import { h, render } from "https://esm.sh/preact@10.19.2";
import { useCallback, useEffect, useMemo, useRef, useState } from "https://esm.sh/preact@10.19.2/hooks";

const suggestionChips = ["写毕业论文", "写周报·10分钟", "准备面试", "做一份产品方案"];
const colors = ["#e04b2a", "#0f4c3a", "#b88a2d", "#1c1c1c", "#a04959"];

const Celebration = ({ shots }) => (
  h("div", { class: "celebrate" },
    shots.map((shot) =>
      h("span", {
        key: shot.id,
        class: "confetti",
        style: `left:${shot.x}%; top:${shot.y}%; background:${shot.color}; animation-delay:${shot.delay}ms;`
      })
    )
  )
);

const StepCard = ({
  step,
  disabled,
  onStart,
  onComplete,
  onStuck,
  onFeedbackChange,
}) => {
  const isIdle = step.state === "idle";
  const inProgress = step.state === "inProgress";
  const isDone = step.state === "done";
  const isStuck = step.state === "stuck";
  const showFeedbackInput = inProgress || isStuck;
  const feedbackText = (step.feedback_answer || "").trim();
  const showFeedbackSummary = isDone && feedbackText;
  return h("article", { class: `card ${isDone ? "card-done" : ""} ${isStuck ? "card-stuck" : ""}` },
    h("div", { class: "badge" }, step.index),
    h("div", null,
      h("h3", null, step.title),
      step.subtitle && h("div", { class: "meta ghost" }, step.subtitle),
      h("div", { class: "meta" },
        h("span", null, `${step.estimate_minutes} 分钟`),
        step.feedback_question && h("span", { class: "ghost" }, step.feedback_question)
      ),
    ),
    h("div", { class: "step-actions" },
      isIdle && h("button", {
        class: "step-btn",
        disabled,
        onClick: onStart
      }, "开始"),
      inProgress && [
        h("button", {
          class: "step-btn done",
          disabled,
          onClick: onComplete
        }, "完成"),
        h("button", {
          class: "step-btn stuck",
          disabled,
          onClick: onStuck
        }, "遇到困难")
      ],
      isDone && h("button", {
        class: "step-btn done",
        disabled: true,
        onClick: onComplete
      }, "已完成"),
      isStuck && h("button", {
        class: "step-btn stuck",
        disabled: true,
        onClick: onStuck
      }, "遇到困难")
    ),
    (showFeedbackInput || showFeedbackSummary) && h("div", { class: `feedback ${showFeedbackInput ? "" : "feedback-collapsed"}` },
      showFeedbackInput
        ? [
            h("div", { class: "row" },
              h("span", { class: "muted" }, "你有什么感受，遇到了什么困难吗？"),
              h("span", { class: "ghost" }, "用于调整后续步骤")
            ),
            h("textarea", {
              rows: 2,
              value: step.feedback_answer || "",
              placeholder: step.feedback_question || "你有什么感受，遇到了什么困难吗？",
              onInput: (e) => onFeedbackChange(e.target.value),
              disabled: isDone && disabled,
            })
          ]
        : [
            h("div", { class: "row" },
              h("span", { class: "muted" }, step.feedback_question || "反馈记录"),
              h("span", { class: "ghost" }, "已完成")
            ),
            h("div", { class: "feedback-summary" }, feedbackText)
          ]
    )
  );
};

function useProgress(steps) {
  return useMemo(() => {
    const total = steps.length;
    const done = steps.filter((s) => s.state === "done").length;
    const minutes = steps.reduce((sum, s) => sum + (s.estimate_minutes || 0), 0);
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { total, done, minutes, percent };
  }, [steps]);
}

const App = () => {
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("等待一句话的任务描述。");
  const [confetti, setConfetti] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const abortRef = useRef(null);
  const offsetRef = useRef(0);
  const taskRef = useRef("");
  const stepsRef = useRef([]);

  const progress = useProgress(steps);

  const handleEvent = useCallback((block, offset = 0) => {
    const lines = block.split("\n").filter(Boolean);
    let event = "message";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.replace("event:", "").trim();
      if (line.startsWith("data:")) data += line.replace("data:", "").trim();
    }
    if (event === "step") {
      try {
        const payload = JSON.parse(data);
        const nextStep = {
          index: offset + payload.index,
          title: payload.title,
          subtitle: payload.subtitle,
          estimate_minutes: payload.estimate_minutes,
          feedback_question: payload.feedback_question,
          feedback_answer: "",
          state: "idle", // idle -> inProgress -> done
        };
        setSteps((prev) => [...prev, nextStep]);
      } catch (e) {
        console.error("Failed to parse step", e);
      }
    } else if (event === "error") {
      try {
        const payload = JSON.parse(data);
        setStatus(payload.message || "生成失败");
        alert(payload.message || "生成失败");
      } catch {
        setStatus("生成失败");
        alert("生成失败");
      }
    }
  }, []);

  const streamPlan = useCallback(async (taskContent, completed, signal, offset) => {
    const res = await fetch("/api/plan/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskContent, completed }),
      signal,
    });
    if (!res.ok || !res.body) {
      const txt = await res.text();
      throw new Error(txt || "请求失败");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) handleEvent(part, offset);
    }
    if (buffer.trim()) handleEvent(buffer, offset);
  }, [handleEvent]);

  const fireCelebration = useCallback(() => {
    const now = Date.now();
    const shots = Array.from({ length: 18 }).map((_, i) => ({
      id: `${now}-${i}`,
      x: Math.random() * 80 + 10,
      y: 72 + Math.random() * 12,
      delay: i * 14,
      color: colors[i % colors.length],
    }));
    setConfetti(shots);
    setTimeout(() => setConfetti([]), 1100);
  }, []);

  const startStreaming = useCallback(async ({ reset, overrideSteps } = {}) => {
    if (!taskRef.current) return;
    if (streaming && abortRef.current) abortRef.current.abort();

    const baseSteps = overrideSteps ?? stepsRef.current;
    const completed = baseSteps
      .filter((s) => s.state === "done" || s.state === "stuck")
      .map((s) => ({
        title: s.title,
        subtitle: s.subtitle,
        estimate_minutes: s.estimate_minutes,
        feedback_question: s.feedback_question,
        feedback_answer: s.state === "stuck"
          ? ((s.feedback_answer || "").trim() ? `遇到困难：${s.feedback_answer}` : "遇到困难")
          : (s.feedback_answer || ""),
      }));

    const nextSteps = reset ? [] : baseSteps.filter((s) => s.state === "done" || s.state === "stuck");
    offsetRef.current = nextSteps.reduce((max, s) => Math.max(max, s.index || 0), 0);
    setSteps(nextSteps);
    setStreaming(true);
    setStatus("流式生成中…");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamPlan(taskRef.current, completed, controller.signal, offsetRef.current);
      const hasAnySteps = (stepsRef.current || []).length > 0;
      setStatus(hasAnySteps ? "完成后随时调整。" : "没有生成任何步骤。");
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus(err.message || "出错了，请稍后再试。");
        alert(err.message || "出错了，请稍后再试。");
      }
    } finally {
      setStreaming(false);
    }
  }, [streamPlan, streaming]);

  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = (task || "").trim();
    if (!trimmed) {
      setStatus("先写下你要做的事情。");
      return;
    }
    taskRef.current = trimmed;
    setStatus("拆解中…");
    setSubmitted(true);
    await startStreaming({ reset: true });
  }, [startStreaming, task]);

  const resetTask = useCallback(() => {
    abortRef.current?.abort();
    taskRef.current = "";
    stepsRef.current = [];
    offsetRef.current = 0;
    setTask("");
    setSteps([]);
    setStatus("等待一句话的任务描述。");
    setStreaming(false);
    setSubmitted(false);
  }, []);

  const startStep = useCallback((index) => {
    setSteps((prev) => prev.map((s) => (s.index === index ? { ...s, state: "inProgress" } : s)));
  }, []);

  const completeStep = useCallback(async (index) => {
    let snapshot = [];
    let feedbackText = "";
    setSteps((prev) => {
      const next = prev.map((s) => {
        if (s.index !== index) return s;
        feedbackText = s.feedback_answer || "";
        return { ...s, state: "done" };
      });
      snapshot = next;
      return next;
    });
    fireCelebration();
    if (!(feedbackText || "").trim()) return;
    await startStreaming({ reset: false, overrideSteps: snapshot });
  }, [fireCelebration, startStreaming]);

  const markStuck = useCallback(async (index) => {
    let snapshot = [];
    setSteps((prev) => {
      const next = prev.map((s) => (s.index === index ? { ...s, state: "stuck" } : s));
      snapshot = next;
      return next;
    });
    await startStreaming({ reset: false, overrideSteps: snapshot });
  }, [startStreaming]);

  const updateFeedback = useCallback((index, val) => {
    setSteps((prev) =>
      prev.map((s) => (s.index === index ? { ...s, feedback_answer: val } : s))
    );
  }, []);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return h("div", { class: "frame stack" },
    h("div", { class: "grain" }),
    h("header", null,
      h("div", null,
        h("h1", { class: "title" }, "Make Progress"),
      ),
      h("div", { class: "tagline" },
        h("span", { class: "accent" }, "即时"),
        "生成 · 反馈驱动"
      ),
      submitted && h("button", {
        type: "button",
        class: "ghost-btn",
        onClick: resetTask,
        disabled: streaming
      }, streaming ? "处理中…" : "新任务")
    ),
    !submitted && h("form", { onSubmit },
      h("label", { class: "ghost" }, "你想做什么？一句话就够。"),
      h("textarea", {
        value: task,
        placeholder: "“写一段开题报告”，或“整理书房 15 分钟”。",
        onInput: (e) => setTask(e.target.value),
      }),
      h("div", { class: "chips" },
        suggestionChips.map((chip) =>
          h("button", {
            type: "button",
            class: "ghost-btn",
            onClick: () => setTask(chip),
          }, chip)
        )
      ),
      h("div", { class: "actions" },
        h("button", { type: "submit", disabled: streaming }, streaming ? "流式生成中…" : "拆解成可执行步骤"),
        taskRef.current && h("span", { class: "ghost" }, taskRef.current)
      )
    ),
    submitted && h("div", { class: "current-task" },
      h("div", null,
        h("div", { class: "muted" }, "当前任务"),
        h("div", { class: "current-task-title" }, taskRef.current || "未命名")
      ),
      h("span", { class: "ghost" }, status)
    ),
    h("div", { class: "status" },
      h("div", null,
        h("div", { class: "muted" }, "当前进度"),
        h("div", { class: "progress-number" }, `${progress.percent}%`)
      ),
      h("div", null,
        h("div", { class: "bar" },
          h("span", { style: `width:${progress.percent}%` })
        ),
        h("div", { class: "ghost" }, status)
      ),
      h("div", { class: "muted" },
        h("div", null, `预计 ${progress.minutes} 分钟`),
        h("div", null, `${progress.done} / ${progress.total} 已完成`)
      )
    ),
    h("section", { class: "steps" },
      steps.map((step) =>
        h(StepCard, {
          key: step.index,
          step,
          disabled: streaming,
          onStart: () => startStep(step.index),
          onComplete: () => completeStep(step.index),
          onStuck: () => markStuck(step.index),
          onFeedbackChange: (val) => updateFeedback(step.index, val),
        })
      ),
      !steps.length && h("div", { class: "empty" }, "等待你的任务。简单描述后点击“拆解”。")
    ),
    h("footer", { class: "footer" },
      h("a", {
        href: "https://github.com/volltin/make-progress",
        target: "_blank",
        rel: "noreferrer",
      }, "Source: github.com/volltin/make-progress")
    ),
    confetti.length > 0 && h(Celebration, { shots: confetti })
  );
};

render(h(App), document.getElementById("root"));
