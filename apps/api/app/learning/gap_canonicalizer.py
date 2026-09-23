import json
import re
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.core.config import get_settings


@dataclass
class CanonicalGapDecision:
    action: str
    gap_key: str
    display_name: str
    description: str


def _normalize_gap_key(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value)
    return value.strip("_")


def canonicalize_gap(
    *,
    concept: str,
    raw_missing_point: str,
    existing_gaps: list[dict[str, str]],
) -> CanonicalGapDecision:
    settings = get_settings()

    client = genai.Client(
        api_key=settings.gemini_api_key,
    )

    existing_gap_text = json.dumps(
        existing_gaps,
        indent=2,
    )

    prompt = f"""
You are RecallForge AI's knowledge-gap canonicalizer.

Your job is to classify ONE learner mistake into a stable canonical knowledge gap.

Concept:
{concept}

New raw missing point:
{raw_missing_point}

Existing canonical gaps for this concept:
{existing_gap_text}

Rules:

1. Decide whether the new missing point means essentially the same thing as one existing gap.

2. If an existing gap represents the same underlying weakness:
   - action must be "match_existing"
   - reuse that exact existing gap_key
   - reuse its display_name
   - reuse its description

3. If none of the existing gaps represent the same underlying weakness:
   - action must be "create_new"
   - create a short reusable lowercase snake_case gap_key
   - create a concise human-readable display_name
   - create a short description explaining the learner weakness

4. Match by underlying meaning, not exact wording.

5. Do not merge distinct weaknesses merely because they belong to the same broad concept.

6. Do not use outside knowledge to invent unrelated gaps.

Return JSON with exactly:

{{
  "action": "match_existing" or "create_new",
  "gap_key": "...",
  "display_name": "...",
  "description": "..."
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
            "Gemini returned an empty gap canonicalization response"
        )

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "Gap canonicalization returned malformed JSON"
        ) from exc

    if not isinstance(data, dict):
        raise ValueError(
            "Gap canonicalization response must be a JSON object"
        )

    action = data.get("action")
    gap_key = data.get("gap_key")
    display_name = data.get("display_name")
    description = data.get("description")

    if action not in {"match_existing", "create_new"}:
        raise ValueError(
            "Gap canonicalization returned an invalid action"
        )

    if not isinstance(gap_key, str) or not gap_key.strip():
        raise ValueError(
            "Gap canonicalization returned an invalid gap_key"
        )

    if not isinstance(display_name, str) or not display_name.strip():
        raise ValueError(
            "Gap canonicalization returned an invalid display_name"
        )

    if not isinstance(description, str) or not description.strip():
        raise ValueError(
            "Gap canonicalization returned an invalid description"
        )

    gap_key = _normalize_gap_key(gap_key)

    if action == "match_existing":
        existing_by_key = {
            gap["gap_key"]: gap
            for gap in existing_gaps
        }

        if gap_key not in existing_by_key:
            raise ValueError(
                "Gap canonicalizer tried to match a gap_key "
                "that does not exist"
            )

        existing = existing_by_key[gap_key]

        return CanonicalGapDecision(
            action="match_existing",
            gap_key=existing["gap_key"],
            display_name=existing["display_name"],
            description=existing["description"],
        )

    return CanonicalGapDecision(
        action="create_new",
        gap_key=gap_key,
        display_name=display_name.strip(),
        description=description.strip(),
    )