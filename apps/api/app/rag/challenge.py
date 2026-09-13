from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.rag.context import RagContext



@dataclass
class ChallengeQuestion:
    question: str
    expected_answer: str
    explanation: str
    



def generate_challenge_question(
    context: RagContext,
) -> ChallengeQuestion:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    prompt = f"""
You are RecallForge AI in Challenge Mode.

Generate ONE study question using ONLY the evidence below.

Rules:
1. Do not use outside knowledge.
2. The question must be answerable from the provided evidence.
3. Prefer conceptual understanding over trivia.
4. Include:
   - question
   - expected_answer
   - explanation
5. Keep the explanation grounded in the evidence.
6. Do not include source labels inside the question itself.

Evidence:
{context.text}
"""

    response = client.models.generate_content(
        model=settings.reranker_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )

    raw_text = (response.text or "").strip()

    if not raw_text:
        raise RuntimeError(
            "Gemini returned an empty challenge response"
        )

    import json

    data = json.loads(raw_text)

    return ChallengeQuestion(
        question=data["question"],
        expected_answer=data["expected_answer"],
        explanation=data["explanation"],
    )