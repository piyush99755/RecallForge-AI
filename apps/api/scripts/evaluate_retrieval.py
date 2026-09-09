import json
from pathlib import Path

from app.db.session import SessionLocal
from app.retrieval.hybrid import hybrid_search


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

    hit_at_1 = 0
    hit_at_3 = 0
    hit_at_5 = 0

    reciprocal_rank_total = 0.0

    try:
        for case in cases:
            results = hybrid_search(
                db=db,
                query=case["query"],
                limit=TOP_K,
            )

            rank = find_expected_rank(
                results,
                case["expected_contains"],
            )

            if rank == 1:
                hit_at_1 += 1

            if rank is not None and rank <= 3:
                hit_at_3 += 1

            if rank is not None and rank <= 5:
                hit_at_5 += 1

            if rank is not None:
                reciprocal_rank_total += 1 / rank

            print("=" * 70)
            print("CASE:", case["name"])
            print("QUERY:", case["query"])
            print(
                "EXPECTED:",
                case["expected_contains"],
            )

            if rank is None:
                print("RESULT: MISS")
            else:
                print("RESULT: HIT")
                print("EXPECTED RANK:", rank)

                matched = results[rank - 1]

                print(
                    "SECTION:",
                    matched.section_title,
                )
                print(
                    "SEMANTIC RANK:",
                    matched.semantic_rank,
                )
                print(
                    "LEXICAL RANK:",
                    matched.lexical_rank,
                )

        print("\n" + "=" * 70)
        print("RETRIEVAL EVALUATION")
        print("=" * 70)

        print("Cases:", total_cases)

        print(
            "Hit@1:",
            f"{hit_at_1 / total_cases:.2%}",
        )

        print(
            "Hit@3:",
            f"{hit_at_3 / total_cases:.2%}",
        )

        print(
            "Hit@5:",
            f"{hit_at_5 / total_cases:.2%}",
        )

        print(
            "MRR:",
            f"{reciprocal_rank_total / total_cases:.4f}",
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()
