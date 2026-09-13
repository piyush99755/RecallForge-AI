from dataclasses import dataclass

from app.retrieval.hybrid import HybridSearchResult


DEFAULT_MAX_SEMANTIC_DISTANCE = 0.42


@dataclass
class RetrievalConfidence:
    sufficient: bool
    best_semantic_distance: float | None
    reason: str


def evaluate_retrieval_confidence(
    results: list[HybridSearchResult],
    max_semantic_distance: float = DEFAULT_MAX_SEMANTIC_DISTANCE,
) -> RetrievalConfidence:
    if not results:
        return RetrievalConfidence(
            sufficient=False,
            best_semantic_distance=None,
            reason="no_results",
        )

    semantic_distances = [
        result.semantic_distance
        for result in results
        if result.semantic_distance is not None
    ]

    if not semantic_distances:
        return RetrievalConfidence(
            sufficient=False,
            best_semantic_distance=None,
            reason="no_semantic_signal",
        )

    best_distance = min(semantic_distances)

    if best_distance > max_semantic_distance:
        return RetrievalConfidence(
            sufficient=False,
            best_semantic_distance=best_distance,
            reason="semantic_distance_too_high",
        )

    return RetrievalConfidence(
        sufficient=True,
        best_semantic_distance=best_distance,
        reason="sufficient",
    )