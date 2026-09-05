from dataclasses import dataclass
import re
from app.ingestion.parsers.types import ParsedPage
from app.ingestion.structure.headings import is_heading


@dataclass
class ParsedSection:
    title: str | None
    level: int
    order_index: int
    page_start: int
    page_end: int
    text: str
    parent_order_index: int | None = None


def detect_heading_level(line: str) -> int:
    text = line.strip()

    # Markdown headings
    if text.startswith("###### "):
        return 6
    if text.startswith("##### "):
        return 5
    if text.startswith("#### "):
        return 4
    if text.startswith("### "):
        return 3
    if text.startswith("## "):
        return 2
    if text.startswith("# "):
        return 1

    # Numbered headings:
    # 1.        -> level 1
    # 1.2       -> level 2
    # 1.2.3     -> level 3
    match = re.match(r"^(\d+(?:\.\d+)*)[\.\)]?\s+", text)

    if match:
        number_part = match.group(1)
        return number_part.count(".") + 1

    return 1


def build_sections(pages: list[ParsedPage]) -> list[ParsedSection]:
    sections: list[ParsedSection] = []

    current_title: str | None = None
    current_level = 1
    current_lines: list[str] = []
    current_page_start: int | None = None
    current_page_end: int | None = None

    def flush_current_section() -> None:
        nonlocal current_title
        nonlocal current_level
        nonlocal current_lines
        nonlocal current_page_start
        nonlocal current_page_end

        text = "\n".join(current_lines).strip()

        if current_title is None and not text:
            return

        sections.append(
            ParsedSection(
                title=current_title,
                level=current_level,
                order_index=len(sections),
                page_start=current_page_start or 1,
                page_end=current_page_end or current_page_start or 1,
                text=text,
            )
        )

        current_title = None
        current_level = 1
        current_lines = []
        current_page_start = None
        current_page_end = None

    for page in pages:
        for raw_line in page.text.splitlines():
            line = raw_line.strip()

            if not line:
                continue

            if is_heading(line):
                flush_current_section()

                current_title = line
                current_level = detect_heading_level(line)
                current_page_start = page.page_number
                current_page_end = page.page_number

            else:
                if current_page_start is None:
                    current_page_start = page.page_number

                current_page_end = page.page_number
                current_lines.append(line)

    flush_current_section()

    return sections