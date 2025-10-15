import os
from typing import List, Literal, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Optional: load .env if present
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# OpenAI-compatible client (supports OpenAI / OpenRouter)
try:
    from openai import OpenAI  # type: ignore
except Exception as e:
    OpenAI = None  # type: ignore

API_BASE = os.getenv("LLM_API_BASE")  # e.g., https://api.openai.com/v1 or https://openrouter.ai/api/v1
API_KEY = os.getenv("LLM_API_KEY")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

app = FastAPI(title="SoulSync Backend", docs_url=None, redoc_url=None)

# Serve static files (index.html, app.js, styles.css) from current directory
static_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# CORS (safe defaults when serving same-origin; widen if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None

class ChatResponse(BaseModel):
    content: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if OpenAI is None:
        raise HTTPException(status_code=500, detail="OpenAI client not installed. Install requirements and set env.")
    if not API_KEY:
        raise HTTPException(status_code=500, detail="LLM_API_KEY is not set in environment.")

    # Initialize client
    try:
        client = OpenAI(api_key=API_KEY, base_url=API_BASE) if API_BASE else OpenAI(api_key=API_KEY)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to init client: {e}")

    model = req.model or MODEL
    try:
        # Non-streaming simple chat completion
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": m.role, "content": m.content} for m in req.messages],
            temperature=0.7,
        )
        content = resp.choices[0].message.content or ""
        return ChatResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")
