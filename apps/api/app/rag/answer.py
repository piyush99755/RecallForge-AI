from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.rag.context import RagContext
from app.rag.modes import StudyMode


@dataclass
class RagAnswer:
    answer: str


def generate_grounded_answer(
    question: str,
    context: RagContext,
    mode: StudyMode = StudyMode.beginner,
) -> RagAnswer:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )
    
    mode_instructions = {
        StudyMode.beginner: """
    Explain the answer in simple, beginner-friendly language.
    Define technical terms when they first appear.
    Use a small example or analogy when useful.
    Focus on understanding rather than sounding advanced.
    """,
        StudyMode.interview: """
    Give a concise interview-ready answer.
    Lead with the direct answer first.
    Mention the key mechanism, important tradeoff, and common follow-up point when supported by the evidence.
    Avoid unnecessary background.
    """,
        StudyMode.senior: """
    Give a deeper senior-engineering explanation.
    Focus on mechanisms, tradeoffs, failure modes, constraints, architecture implications, and how the behavior would be tested or measured when supported by the evidence.
    Do not add unsupported knowledge.
    """,
    }

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

    Answer style:
    {mode_instructions[mode]}
    
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