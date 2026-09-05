from pathlib import Path

import fitz

from app.ingestion.parsers.types import ParsedPage


def parse_pdf(path: Path) -> list[ParsedPage]:
    pages: list[ParsedPage] = []

    with fitz.open(path) as document:
        for page_index, page in enumerate(document):
            text = page.get_text("text").strip()

            pages.append(
                ParsedPage(
                    page_number=page_index + 1,
                    text=text,
                )
            )

    return pages