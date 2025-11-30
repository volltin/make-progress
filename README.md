# Make Progress

极简分步工具：写下任务，自动拆成小步骤，第一步只需 1 分钟，帮助拖延症用户获得正反馈。

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | 要调用的模型名（如 `gpt-4o-mini`） |
| `OPENAI_BASE_URL` | 可选，自定义网关或代理的 base url |

必须配置 `OPENAI_API_KEY` 和 `OPENAI_MODEL`，否则接口会直接报错。

## 快速开始（推荐 uv，Python 3.10+）

```bash
uv sync

export OPENAI_API_KEY=...
export OPENAI_MODEL=gpt-5.1-chat
export OPENAI_BASE_URL=https://api.openai.com/v1   # 可选

# 也可以用 .env 文件（与 app.py 同目录），内容示例：
# OPENAI_API_KEY=sk-xxx
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1

uv run uvicorn app:app --reload --port 8000
```

如果不用 uv，可按常规方式：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

浏览器打开 http://localhost:8000 ，在手机或桌面均可使用。点击步骤上的“完成”可即时更新进度和预计时间。

## Docker 运行

```bash
# 构建镜像
docker build -t make-progress .

# 运行（记得传入模型配置，如：Openrouter）
docker run --rm -p 8000:8000 \
  -e OPENAI_API_KEY=sk-... \
  -e OPENAI_BASE_URL="https://openrouter.ai/api/v1" \
  -e OPENAI_MODEL="openai/gpt-5.1-chat" \
  make-progress

# 如需自定义 base url 或端口：
# -e OPENAI_BASE_URL=https://api.openai.com/v1 \
# -e PORT=8080 \
```

容器入口命令为 `uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}`。也可以用 `--env-file .env` 一次性加载环境变量。

## 代码结构

- `app.py`：入口，导出 FastAPI 实例（供 `uvicorn app:app` 使用）
- `make_progress/app.py`：FastAPI 配置与路由
- `make_progress/services.py`：拆解与流式生成逻辑
- `make_progress/llm.py`：LLM 参数构建、JSON Schema、解析
- `make_progress/prompts.py`：提示词与 schema 定义
- `make_progress/models.py`：Pydantic 请求/响应模型
- `public/`：前端页面与资源（`index.html`、`app.js`、`styles.css`）
