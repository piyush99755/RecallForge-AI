import json
from dataclasses import dataclass
from uuid import UUID

from google import genai

from app.core.config import get_settings
from app.retrieval.hybrid import HybridSearchResult
from google.genai import types


@dataclass
class RerankedSearchResult:
    chunk_id: UUID
    content: str
    chunk_type: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    document_title: str
    document_id: UUID
    document_version_id: UUID
    project_id: UUID
    hybrid_score: float
    semantic_rank: int | None
    lexical_rank: int | None
    rerank_score: float


def rerank_results(
    query: str,
    candidates: list[HybridSearchResult],
    limit: int = 5,
) -> list[RerankedSearchResult]:
    if not candidates:
        return []

    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    candidate_payload = [
        {
            "index": index,
            "content": candidate.content,
        }
        for index, candidate in enumerate(candidates)
    ]

    prompt = f"""
You are a retrieval reranker.

Given a user query and candidate text chunks, score how useful each chunk is
for answering the query.

Return ONLY valid JSON as a list.

Each item must contain:
- index: candidate index
- score: number from 0.0 to 1.0

Higher score means the chunk is more directly useful for answering the query.

User query:
{query}

Candidates:
{json.dumps(candidate_payload, ensure_ascii=False)}
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
            "Gemini reranker returned an empty response"
        )

    try:
        scores = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Gemini reranker returned invalid JSON: {raw_text!r}"
        ) from exc
        
    if not isinstance(scores, list):
        raise RuntimeError(
            "Gemini reranker response must be a JSON list"
        )
        

    score_by_index: dict[int, float] = {}

    for item in scores:
        if not isinstance(item, dict):
            continue

        if "index" not in item or "score" not in item:
            continue

        index = int(item["index"])
        score = float(item["score"])

        if 0 <= index < len(candidates):
            score_by_index[index] = max(
                0.0,
                min(1.0, score),
            )

        reranked = []

    for index, candidate in enumerate(candidates):
        reranked.append(
            RerankedSearchResult(
                chunk_id=candidate.chunk_id,
                content=candidate.content,
                chunk_type=candidate.chunk_type,
                section_title=candidate.section_title,
                page_start=candidate.page_start,
                page_end=candidate.page_end,
                document_title=candidate.document_title,
                document_id=candidate.document_id,
                document_version_id=candidate.document_version_id,
                project_id=candidate.project_id,
                hybrid_score=candidate.hybrid_score,
                semantic_rank=candidate.semantic_rank,
                lexical_rank=candidate.lexical_rank,
                rerank_score=score_by_index.get(index, 0.0),
            )
        )

    reranked.sort(
        key=lambda item: item.rerank_score,
        reverse=True,
    )

    return reranked[:limit]