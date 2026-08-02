import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "openrouter")


PROVIDERS: dict = {
    "openrouter": {
        "base_url":    "https://openrouter.ai/api/v1",
        "api_key_env": "OPENROUTER_API_KEY",
        "model":       "openai/gpt-oss-20b:free",
    },
    "groq": {
        "base_url":    "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "model":       "llama-3.3-70b-versatile",
    },
}
