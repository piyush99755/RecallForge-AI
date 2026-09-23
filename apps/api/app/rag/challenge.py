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
    target_concept: str | None = None,
    target_gap: str | None = None,
    target_gap_description: str | None = None,
) -> ChallengeQuestion:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    normalized_target_concept = (
        target_concept.strip().lower()
        if target_concept is not None
        else None
    )

    normalized_target_gap = (
        target_gap.strip().lower()
        if target_gap is not None
        else None
    )

    normalized_gap_description = (
        target_gap_description.strip()
        if target_gap_description is not None
        else None
    )

    concept_instruction = ""

    if normalized_target_concept is not None:
        concept_instruction = f"""
The challenge MUST specifically test this concept:

{normalized_target_concept}

Do not generate a challenge about another concept found in the evidence.

The returned "concept" field MUST be exactly:

{normalized_target_concept}
"""

    gap_instruction = ""

    if normalized_target_gap is not None:
        gap_instruction = f"""
The learner has a known recurring knowledge gap within this concept.

Canonical gap key:

{normalized_target_gap}

Gap description:

{normalized_gap_description or "No additional description provided."}

The challenge MUST specifically test whether the learner understands
and can correct this knowledge gap.

Focus the question on this weakness rather than testing some other
part of the broader concept.

Do not drift to another weakness merely because it appears elsewhere
in the retrieved evidence.

The question must still be answerable using ONLY the evidence below.
"""

    prompt = f"""
You are RecallForge AI in Challenge Mode.

Generate ONE study question using ONLY the provided evidence.

{concept_instruction}

{gap_instruction}

Rules:

1. Do not use outside knowledge.

2. The question must be fully answerable from the provided evidence.

3. Prefer conceptual understanding over trivia or memorization.

4. If a target knowledge gap is provided:
   - specifically test that knowledge gap
   - do not switch to another weakness within the same concept
   - make the expected answer address that gap directly

5. Identify the specific concept actually being tested.

6. The concept must:
   - represent the specific concept being tested
   - not merely repeat a broad user topic
   - be lowercase
   - use snake_case
   - be short and reusable
   - be grounded in the retrieved evidence

7. Examples of valid concept identifiers:
   - hash_equality_contract
   - dictionary_hashing
   - mutable_default_arguments
   - oauth_token_refresh
   - sms_provider_routing

8. Return valid JSON containing exactly these fields:
   - "concept"
   - "question"
   - "expected_answer"
   - "explanation"

9. The "question" should test understanding rather than reveal the answer.

10. The "expected_answer" should clearly state the knowledge required
    to answer the question correctly.

11. The "explanation" should explain why the expected answer is correct
    using only the provided evidence.

12. Do not include source labels inside the question.

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
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Challenge generation returned malformed JSON: {exc}"
        ) from exc

    if not isinstance(data, dict):
        raise ValueError(
            "Challenge generation JSON response must be an object"
        )

    concept = data.get("concept")

    if not isinstance(concept, str) or not concept.strip():
        raise ValueError(
            "Challenge generation returned a missing or invalid concept"
        )

    concept = concept.strip().lower()

    if (
        normalized_target_concept is not None
        and concept != normalized_target_concept
    ):
        raise ValueError(
            "Generated challenge concept does not match "
            "the requested review concept: "
            f"expected '{normalized_target_concept}', "
            f"got '{concept}'"
        )

    question = data.get("question")

    if not isinstance(question, str) or not question.strip():
        raise ValueError(
            "Challenge generation returned a missing or invalid question"
        )

    expected_answer = data.get("expected_answer")

    if (
        not isinstance(expected_answer, str)
        or not expected_answer.strip()
    ):
        raise ValueError(
            "Challenge generation returned a missing or invalid "
            "expected_answer"
        )

    explanation = data.get("explanation")

    if (
        not isinstance(explanation, str)
        or not explanation.strip()
    ):
        raise ValueError(
            "Challenge generation returned a missing or invalid explanation"
        )

    return ChallengeQuestion(
        concept=concept,
        question=question.strip(),
        expected_answer=expected_answer.strip(),
        explanation=explanation.strip(),
    )