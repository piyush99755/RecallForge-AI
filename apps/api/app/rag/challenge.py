import json
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.rag.context import RagContext


@dataclass
class ChallengeQuestion:
    concept: str
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
    4. Identify the specific concept actually being tested by the generated question.
       - The concept must represent the specific concept actually tested, not merely the broad user topic.
       - The concept must be lowercase, snake_case, short, and reusable.
       - Examples: hash_equality_contract, dictionary_hashing, mutable_default_arguments, oauth_token_refresh, sms_provider_routing.
       - Must be based only on retrieved evidence.
    5. Return valid JSON containing exactly these fields:
       - "concept": (lowercase snake_case string)
       - "question": (string)
       - "expected_answer": (string)
       - "explanation": (string)
    6. Do not include source labels inside the question.

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

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Challenge generation returned malformed JSON: {e}"
        ) from e

    if not isinstance(data, dict):
        raise ValueError("Challenge generation JSON response must be an object")

    concept = data.get("concept")
    if not isinstance(concept, str) or not concept.strip():
        raise ValueError(
            "Challenge generation returned a missing or invalid concept"
        )

    question = data.get("question")
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Challenge generation returned a missing or invalid question")

    expected_answer = data.get("expected_answer")
    if not isinstance(expected_answer, str) or not expected_answer.strip():
        raise ValueError("Challenge generation returned a missing or invalid expected_answer")

    explanation = data.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        raise ValueError("Challenge generation returned a missing or invalid explanation")

    return ChallengeQuestion(
        concept=concept.strip().lower(),
        question=question.strip(),
        expected_answer=expected_answer.strip(),
        explanation=explanation.strip(),
    )