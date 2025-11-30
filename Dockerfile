# syntax=docker/dockerfile:1

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# 1) Install uv
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh

# 2) Copy dependency files first for better caching
COPY pyproject.toml uv.lock requirements.txt README.md ./

# 3) Install Python deps with uv (system site-packages)
RUN uv pip install --system -r requirements.txt

# 4) Copy application code
COPY make_progress ./make_progress
COPY public ./public
COPY app.py ./app.py

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
