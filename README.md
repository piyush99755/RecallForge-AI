# RecallForge AI

RecallForge AI is a personal AI study engine for searching, understanding, and learning from technical project journals, PDFs, notes, code, debugging stories, and interview material.

## Planned capabilities

- Grounded natural-language search
- Exact source citations
- Code-aware retrieval
- Beginner, interview, and senior explanation modes
- Cross-project comparison
- Quiz and flashcard generation
- Knowledge-gap tracking
- Retrieval evaluation

## Architecture

This project uses a monorepo structure:

- `apps/api` — FastAPI backend
- `apps/web` — Next.js frontend
- `docs` — architecture and engineering decisions
- `evals` — retrieval and RAG evaluation
- `infra` — infrastructure and deployment