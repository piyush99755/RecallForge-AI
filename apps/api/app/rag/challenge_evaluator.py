import json
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings


@dataclass
class ChallengeEvaluation:
    score: float
    correct: bool
    feedback: str
    missing_points: list[str]


def evaluate_challenge_answer(
    question: str,
    expected_answer: str,
    user_answer: str,
) -> ChallengeEvaluation:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    prompt = f"""
You are RecallForge AI evaluating a learner's answer.

Evaluate the user's answer against the expected answer.

Rules:
1. Evaluate meaning, not exact wording.
2. Do not require the user to repeat every sentence verbatim.
3. Give credit for technically equivalent explanations.
4. Do not introduce outside knowledge.
5. Score from 0.0 to 1.0.
6. correct should be true when the answer demonstrates sufficient understanding.
7. missing_points should contain only important concepts that were actually missing.
8. feedback should be concise, constructive, and specific.

Question:
{question}

Expected answer:
{expected_answer}

User answer:
{user_answer}

Return JSON with exactly:
{{
  "score": 0.0,
  "correct": false,
  "feedback": "...",
  "missing_points": ["..."]
}}
"""

    response = client.models.generate_content(
        model=settings.reranker_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )

    raw_text = (response.text or "").strip()

    if not raw_text:
        raise RuntimeError(
            "Gemini returned an empty challenge evaluation"
        )

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Gemini returned invalid evaluation JSON: {raw_text!r}"
        ) from exc

    score = float(data["score"])

    score = max(
        0.0,
        min(1.0, score),
    )

    missing_points = data.get(
        "missing_points",
        [],
    )

    if not isinstance(missing_points, list):
        missing_points = []

    return ChallengeEvaluation(
        score=score,
        correct=bool(data["correct"]),
        feedback=str(data["feedback"]),
        missing_points=[
            str(point)
            for point in missing_points
        ],
    )