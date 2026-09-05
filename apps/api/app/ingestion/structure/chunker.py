import re
from dataclasses import dataclass

from app.ingestion.structure.sections import ParsedSection


@dataclass
class ParsedChunk:
    chunk_index: int
    content: str
    page_start: int
    page_end: int
    chunk_type: str = "text"
    code_language: str | None = None


def split_qa_units(text: str) -> list[str]:
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    units: list[str] = []
    current_lines: list[str] = []

    for line in lines:
        if line.startswith("Q:") and current_lines:
            units.append("\n".join(current_lines).strip())
            current_lines = []

        current_lines.append(line)

    if current_lines:
        units.append("\n".join(current_lines).strip())

    return units


def looks_like_qa_section(text: str) -> bool:
    question_count = len(
        re.findall(r"(?m)^Q:\s+", text)
    )

    answer_count = len(
        re.findall(r"(?m)^A:\s+", text)
    )

    return question_count >= 2 and answer_count >= 2


def chunk_section(
    section: ParsedSection,
    max_characters: int = 1800,
) -> list[ParsedChunk]:
    text = section.text.strip()

    if not text:
        return []

    if looks_like_qa_section(text):
        units = split_qa_units(text)
        chunk_type = "interview_qa"
    else:
        units = [
            paragraph.strip()
            for paragraph in text.split("\n")
            if paragraph.strip()
        ]
        chunk_type = "text"

    chunks: list[ParsedChunk] = []
    current_units: list[str] = []
    current_length = 0

    def flush_chunk() -> None:
        nonlocal current_units
        nonlocal current_length

        if not current_units:
            return

        content = "\n\n".join(current_units).strip()

        chunks.append(
            ParsedChunk(
                chunk_index=len(chunks),
                content=content,
                page_start=section.page_start,
                page_end=section.page_end,
                chunk_type=chunk_type,
            )
        )

        current_units = []
        current_length = 0

    for unit in units:
        unit_length = len(unit)

        if (
            current_units
            and current_length + unit_length > max_characters
        ):
            flush_chunk()

        current_units.append(unit)
        current_length += unit_length

    flush_chunk()

    return chunks