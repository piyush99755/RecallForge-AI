from pathlib import Path

import pymupdf

from app.ingestion.parsers.types import ParsedPage


def parse_pdf(source: Path | str | bytes) -> list[ParsedPage]:
    pages: list[ParsedPage] = []

    if isinstance(source, bytes):
        doc_context = pymupdf.open(stream=source, filetype="pdf")
    else:
        doc_context = pymupdf.open(Path(source))

    with doc_context as document:
        for page_index, page in enumerate(document):
            text = page.get_text("text").strip()

            pages.append(
                ParsedPage(
                    page_number=page_index + 1,
                    text=text,
                )
            )

    return pages
