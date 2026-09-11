import json
from pathlib import Path

from app.db.session import SessionLocal
from app.retrieval.hybrid import hybrid_search
from app.retrieval.reranker import rerank_results


EVAL_FILE = Path(__file__).resolve().parents[3] / "evals" / "retrieval_cases.json"

TOP_K = 5


def find_expected_rank(
        results,
        expected_contains: str,
    ) -> int | None:
        expected = expected_contains.lower()

        for rank, result in enumerate(results, start=1):
            if expected in result.content.lower():
                return rank

        return None
    
def main() -> None:
    cases = json.loads(
        EVAL_FILE.read_text(encoding="utf-8")
    )

    db = SessionLocal()

    total_cases = len(cases)

    hybrid_hit_at_1 = 0
    hybrid_hit_at_3 = 0
    hybrid_hit_at_5 = 0
    hybrid_rr_total = 0.0

    reranked_hit_at_1 = 0
    reranked_hit_at_3 = 0
    reranked_hit_at_5 = 0
    reranked_rr_total = 0.0

    try:
        for case in cases:
            hybrid_candidates = hybrid_search(
                db=db,
                query=case["query"],
                limit=10,
            )

            hybrid_results = hybrid_candidates[:TOP_K]

            reranked_results = rerank_results(
                query=case["query"],
                candidates=hybrid_candidates,
                limit=TOP_K,
            )

            hybrid_rank = find_expected_rank(
                hybrid_results,
                case["expected_contains"],
            )

            reranked_rank = find_expected_rank(
                reranked_results,
                case["expected_contains"],
            )

            if hybrid_rank == 1:
                hybrid_hit_at_1 += 1

            if hybrid_rank is not None and hybrid_rank <= 3:
                hybrid_hit_at_3 += 1

            if hybrid_rank is not None and hybrid_rank <= 5:
                hybrid_hit_at_5 += 1

            if hybrid_rank is not None:
                hybrid_rr_total += 1 / hybrid_rank

            if reranked_rank == 1:
                reranked_hit_at_1 += 1

            if reranked_rank is not None and reranked_rank <= 3:
                reranked_hit_at_3 += 1

            if reranked_rank is not None and reranked_rank <= 5:
                reranked_hit_at_5 += 1

            if reranked_rank is not None:
                reranked_rr_total += 1 / reranked_rank

            print("=" * 70)
            print("CASE:", case["name"])
            print("QUERY:", case["query"])
            print("EXPECTED:", case["expected_contains"])

            print("HYBRID RANK:", hybrid_rank)
            print("RERANKED RANK:", reranked_rank)

            if reranked_rank is not None:
                matched = reranked_results[reranked_rank - 1]

                print(
                    "RERANKED SECTION:",
                    matched.section_title,
                )

                print(
                    "RERANK SCORE:",
                    matched.rerank_score,
                )

        print("\n" + "=" * 70)
        print("HYBRID BASELINE")
        print("=" * 70)

        print("Cases:", total_cases)

        print(
            "Hit@1:",
            f"{hybrid_hit_at_1 / total_cases:.2%}",
        )

        print(
            "Hit@3:",
            f"{hybrid_hit_at_3 / total_cases:.2%}",
        )

        print(
            "Hit@5:",
            f"{hybrid_hit_at_5 / total_cases:.2%}",
        )

        print(
            "MRR:",
            f"{hybrid_rr_total / total_cases:.4f}",
        )

        print("\n" + "=" * 70)
        print("HYBRID + RERANKER")
        print("=" * 70)

        print("Cases:", total_cases)

        print(
            "Hit@1:",
            f"{reranked_hit_at_1 / total_cases:.2%}",
        )

        print(
            "Hit@3:",
            f"{reranked_hit_at_3 / total_cases:.2%}",
        )

        print(
            "Hit@5:",
            f"{reranked_hit_at_5 / total_cases:.2%}",
        )

        print(
            "MRR:",
            f"{reranked_rr_total / total_cases:.4f}",
        )

    finally:
        db.close()
        
        
if __name__ == "__main__":
    main()