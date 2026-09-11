from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.rag.context import RagContext


@dataclass
class RagAnswer:
    answer: str


def generate_grounded_answer(
    question: str,
    context: RagContext,
) -> RagAnswer:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    prompt = f"""
You are RecallForge AI, a grounded study assistant.

Answer the user's question using ONLY the evidence provided below.

Rules:
1. Do not use outside knowledge.
2. If the evidence is insufficient, clearly say that the provided sources do not contain enough information.
3. Cite supporting evidence using the exact source labels provided, such as [S1] or [S2].
4. Every factual claim should be supported by at least one source label.
5. Do not invent source labels.
6. Prefer a concise, clear explanation suitable for study and interview preparation.

User question:
{question}

Evidence:
{context.text}
"""

    response = client.models.generate_content(
        model=settings.reranker_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
        ),
    )

    answer_text = (response.text or "").strip()

    if not answer_text:
        raise RuntimeError(
            "Gemini returned an empty grounded answer"
        )

    return RagAnswer(
        answer=answer_text,
    )