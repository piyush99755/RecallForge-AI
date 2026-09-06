from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import Chunk, DocumentVersion, Section
from app.ingestion.structure.chunker import chunk_section
from app.ingestion.structure.sections import ParsedSection


def persist_sections_and_chunks(
    db: Session,
    document_version: DocumentVersion,
    parsed_sections: list[ParsedSection],
) -> tuple[int, int]:
    db.execute(
        delete(Section).where(
            Section.document_version_id == document_version.id
        )
    )

    db.flush()

    section_count = 0
    chunk_count = 0

    for parsed_section in parsed_sections:
        section = Section(
            document_version_id=document_version.id,
            title=parsed_section.title,
            level=parsed_section.level,
            order_index=parsed_section.order_index,
            page_start=parsed_section.page_start,
            page_end=parsed_section.page_end,
            raw_text=parsed_section.text,
        )

        db.add(section)
        db.flush()

        section_count += 1

        parsed_chunks = chunk_section(parsed_section)

        for parsed_chunk in parsed_chunks:
            chunk = Chunk(
                section_id=section.id,
                chunk_index=parsed_chunk.chunk_index,
                content=parsed_chunk.content,
                chunk_type=parsed_chunk.chunk_type,
                token_count=None,
                page_start=parsed_chunk.page_start,
                page_end=parsed_chunk.page_end,
                source_label=parsed_section.title,
                code_language=parsed_chunk.code_language,
            )

            db.add(chunk)
            chunk_count += 1

    document_version.processing_status = "ready_for_embedding"

    db.commit()

    return section_count, chunk_count