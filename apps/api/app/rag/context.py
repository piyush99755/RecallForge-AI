from dataclasses import dataclass

from app.retrieval.reranker import RerankedSearchResult


@dataclass
class RagSource:
    source_id: str
    chunk_id: str
    document_title: str
    section_title: str | None
    page_start: int | None
    page_end: int | None
    content: str


@dataclass
class RagContext:
    text: str
    sources: list[RagSource]


def build_rag_context(
    results: list[RerankedSearchResult],
) -> RagContext:
    sources: list[RagSource] = []
    context_blocks: list[str] = []

    for index, result in enumerate(results, start=1):
        source_id = f"S{index}"

        source = RagSource(
            source_id=source_id,
            chunk_id=str(result.chunk_id),
            document_title=result.document_title,
            section_title=result.section_title,
            page_start=result.page_start,
            page_end=result.page_end,
            content=result.content,
        )

        sources.append(source)

        section = (
            result.section_title
            if result.section_title
            else "Untitled section"
        )

        if (
            result.page_start is not None
            and result.page_end is not None
        ):
            if result.page_start == result.page_end:
                pages = f"Page {result.page_start}"
            else:
                pages = (
                    f"Pages {result.page_start}-{result.page_end}"
                )
        else:
            pages = "Page unknown"

        context_blocks.append(
            "\n".join(
                [
                    f"[{source_id}]",
                    f"Document: {result.document_title}",
                    f"Section: {section}",
                    f"Location: {pages}",
                    "Content:",
                    result.content.strip(),
                ]
            )
        )

    return RagContext(
        text="\n\n---\n\n".join(context_blocks),
        sources=sources,
    )