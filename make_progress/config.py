import os

from dotenv import load_dotenv

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore

# Load environment variables from a local .env file if present.
load_dotenv()


def get_client() -> OpenAI:
    if OpenAI is None:
        raise ValueError("openai package not installed")
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model = os.getenv("OPENAI_MODEL")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required")
    if not model:
        raise ValueError("OPENAI_MODEL is required")
    return OpenAI(api_key=api_key, base_url=base_url or None)


def get_model_name() -> str:
    model = os.getenv("OPENAI_MODEL")
    if not model:
        raise ValueError("OPENAI_MODEL is required")
    return model
