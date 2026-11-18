import argparse
import hashlib
import json
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.embeddings.service import embed_document_version
from app.core.config import get_settings
from app.db.models import (
    ChallengeAttempt,
    ChallengeAttemptGap,
    Chunk,
    ChunkEmbedding,
    ConceptProgress,
    Document,
    DocumentVersion,
    KnowledgeGap,
    Project,
    Section,
    StudyChallenge,
)
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

DEMO_PROJECT_NAME = "Computer Science & AI Systems Vault (Demo)"
DEMO_PROJECT_DESCRIPTION = (
    "Curated public demo study vault covering Python internals, REST API design, "
    "database indexing, machine learning fundamentals, and vector search architectures."
)


def _deterministic_uuid(namespace_key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"recallforge.demo.{namespace_key}")


def _deterministic_vector(seed_text: str, dims: int = 3072) -> list[float]:
    """
    Generates a normalized deterministic embedding vector for offline test environments
    when --offline-embeddings is used.
    """
    vec: list[float] = []
    counter = 0
    while len(vec) < dims:
        digest = hashlib.sha256(f"{seed_text}:{counter}".encode("utf-8")).digest()
        for i in range(0, len(digest), 2):
            if len(vec) >= dims:
                break
            val = int.from_bytes(digest[i : i + 2], "big", signed=True) / 32768.0
            vec.append(val)
        counter += 1
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


DEMO_DOCUMENTS = [
    {
        "key": "python_dicts_hashability",
        "title": "Python Dictionaries, Hash Tables & Object Hashability",
        "filename": "python-dictionaries-and-hashability.pdf",
        "file_size_bytes": 418_240,
        "sections": [
            {
                "title": "Compact Hash Table Layout & Open Addressing",
                "page_start": 1,
                "page_end": 4,
                "chunks": [
                    (
                        "Python 3.6+ dictionaries use a compact open-addressing hash table split into two arrays: "
                        "a sparse hash index array (dk_indices) storing 1-, 2-, 4-, or 8-byte integer offsets, and "
                        "a dense entries array (dk_entries) storing (hash, key_ptr, value_ptr) in insertion order. "
                        "This layout reduces dict memory footprint by 20–25% compared to legacy sparse tables and "
                        "preserves deterministic insertion ordering as a language guarantee."
                    ),
                    (
                        "When a hash collision occurs in a Python dict, open addressing probes subsequent slots using "
                        "a pseudorandom recurrence relation: i = (5 * i + 1 + perturb) mod mask, where perturb is "
                        "shifted right by PERTURB_SHIFT (5 bits) at each step. Incorporating high-order hash bits via "
                        "perturb prevents primary clustering even when many keys share low-order hash bits. Dictionary "
                        "resizing triggers when load factor reaches 2/3 (66.7%) to bound average probe length to O(1)."
                    ),
                ],
            },
            {
                "title": "Object Hashability Contract (__hash__ and __eq__)",
                "page_start": 5,
                "page_end": 8,
                "chunks": [
                    (
                        "For a Python object to be usable as a dict key or set member, it must satisfy the hashability "
                        "invariant: if a == b, then hash(a) == hash(b), and the object's hash value must never change "
                        "during its lifetime. Defining a custom __eq__ on a class without defining __hash__ causes "
                        "Python to set __hash__ = None, making instances unhashable TypeError at runtime."
                    ),
                    (
                        "Built-in immutable types such as str, int, frozenset, and tuples containing only hashable "
                        "elements are hashable. Mutable containers (list, dict, set) are unhashable because mutating "
                        "an element after insertion would change its hash bucket while leaving the entry stranded in "
                        "its original slot in dk_indices, breaking lookup invariants."
                    ),
                ],
            },
        ],
    },
    {
        "key": "rest_api_design",
        "title": "REST API Design, Idempotency & Pagination Patterns",
        "filename": "rest-api-design-architecture.pdf",
        "file_size_bytes": 524_800,
        "sections": [
            {
                "title": "HTTP Method Semantics & Idempotency Keys",
                "page_start": 1,
                "page_end": 5,
                "chunks": [
                    (
                        "In RESTful HTTP architecture, an operation is idempotent if executing the same request "
                        "multiple times produces the same server state as executing it once. GET, HEAD, OPTIONS, PUT, "
                        "and DELETE are idempotent by specification, whereas POST is non-idempotent. However, network "
                        "timeouts require clients to retry POST requests safely (such as payment charges or document "
                        "jobs) using an Idempotency-Key header."
                    ),
                    (
                        "To implement Idempotency-Key handling on POST endpoints, the server stores a composite record "
                        "(client_id, idempotency_key, request_payload_hash, status, response_body) with a unique "
                        "constraint and TTL. Concurrent duplicate requests while the first request is in flight receive "
                        "HTTP 409 Conflict or wait on an advisory lock; retries with a different payload under the same "
                        "key receive HTTP 422 Unprocessable Entity."
                    ),
                ],
            },
            {
                "title": "Cursor-Based Keyset Pagination vs Offset Pagination",
                "page_start": 6,
                "page_end": 10,
                "chunks": [
                    (
                        "OFFSET / LIMIT pagination (SELECT * FROM items ORDER BY created_at DESC LIMIT 50 OFFSET 50000) "
                        "degrades linearly O(N) on large tables because the database engine must scan and discard all "
                        "50,000 preceding rows. In addition, concurrent inserts or deletes shift row offsets, causing "
                        "clients to see duplicate or skipped items across pages."
                    ),
                    (
                        "Cursor-based (keyset) pagination encodes the last seen sort key and tie-breaker UUID into an "
                        "opaque cursor token, executing WHERE (created_at, id) < (:cursor_ts, :cursor_id) ORDER BY "
                        "created_at DESC, id DESC LIMIT 50. Supported by a composite B-Tree index on (created_at DESC, id DESC), "
                        "keyset pagination achieves constant O(log N) seek latency at any depth and prevents page drift."
                    ),
                ],
            },
        ],
    },
    {
        "key": "database_indexing",
        "title": "Database Indexing: B-Trees, LSM-Trees & Query Execution",
        "filename": "database-indexing-and-btrees.pdf",
        "file_size_bytes": 689_120,
        "sections": [
            {
                "title": "B-Tree Internal Pages, Leaf Splits & Write Amplification",
                "page_start": 1,
                "page_end": 6,
                "chunks": [
                    (
                        "PostgreSQL B-Tree indexes organize keys into fixed 8 KB pages with a high fanout (typically "
                        "200–500 keys per internal page), keeping tree depth at 3 to 4 levels for hundreds of millions "
                        "of rows. Leaf pages form a doubly linked list enabling fast range scans (<, <=, BETWEEN, "
                        "ORDER BY) without re-traversing the root."
                    ),
                    (
                        "Log-Structured Merge-trees (LSM-trees) optimize write throughput by buffering mutations in an "
                        "in-memory MemTable and flushing sequential immutable SSTables to disk, trading read amplification "
                        "and background compaction overhead for lower random write amplification compared to in-place "
                        "B-Tree page updates."
                    ),
                ],
            },
            {
                "title": "Composite Index Leftmost Prefix & Covering Indexes",
                "page_start": 7,
                "page_end": 12,
                "chunks": [
                    (
                        "A composite B-Tree index on (project_id, status, created_at) sorts entries lexicographically "
                        "by project_id first, then status, then created_at. Queries filtering on project_id alone or "
                        "(project_id, status) can use the leftmost prefix efficiently, whereas a query filtering only "
                        "on status without project_id cannot perform a direct B-Tree range seek."
                    ),
                    (
                        "A covering index (created in PostgreSQL via CREATE INDEX idx_docs ON documents (project_id) "
                        "INCLUDE (title, created_at)) stores non-key payload columns in leaf pages. When the visibility "
                        "map confirms heap pages are all-visible, PostgreSQL executes an Index-Only Scan, avoiding random "
                        "heap table I/O completely."
                    ),
                ],
            },
        ],
    },
    {
        "key": "machine_learning_fundamentals",
        "title": "Machine Learning Fundamentals: Bias-Variance, Regularization & Gradient Descent",
        "filename": "machine-learning-fundamentals.pdf",
        "file_size_bytes": 612_350,
        "sections": [
            {
                "title": "Bias-Variance Decomposition & L1/L2 Regularization Geometry",
                "page_start": 1,
                "page_end": 6,
                "chunks": [
                    (
                        "Expected generalization error decomposes into Bias^2 + Variance + Irreducible Noise. High-bias "
                        "models underfit by making overly restrictive structural assumptions, while high-variance models "
                        "overfit to training sample noise. Regularization intentionally introduces a controlled bias to "
                        "achieve a larger reduction in parameter variance."
                    ),
                    (
                        "L1 (Lasso) regularization adds lambda * ||w||_1 to the loss objective, whose diamond-shaped L1 "
                        "constraint region has sharp corners along coordinate axes; level sets of the data loss intersect "
                        "these corners, driving weak feature weights to exact zero and performing feature selection. L2 "
                        "(Ridge) regularization adds lambda * ||w||_2^2 with a spherical constraint boundary, shrinking "
                        "correlated weights proportionally without sparse zeroing."
                    ),
                ],
            },
            {
                "title": "Stochastic Gradient Descent, Momentum & AdamW",
                "page_start": 7,
                "page_end": 11,
                "chunks": [
                    (
                        "Mini-batch Stochastic Gradient Descent (SGD) estimates the full-dataset gradient using a batch "
                        "of B examples, reducing per-step compute from O(N) to O(B) while introducing gradient variance "
                        "that helps escape sharp local minima. Classical momentum accumulates an exponentially weighted "
                        "velocity v_t = beta * v_{t-1} + g_t to damp oscillations across high-curvature ravines."
                    ),
                    (
                        "AdamW decouples weight decay from adaptive first- and second-moment gradient normalization "
                        "(m_t / sqrt(v_t) + eps). In standard Adam with L2 penalty, parameters with large historical "
                        "gradients receive smaller effective weight decay; AdamW applies weight decay directly to the "
                        "weights (w <- w - lr * lambda * w) before the adaptive step, improving generalization in "
                        "Transformer training."
                    ),
                ],
            },
        ],
    },
    {
        "key": "vector_search_embeddings",
        "title": "Vector Search, Embeddings & Hybrid RAG Architectures",
        "filename": "vector-search-and-embeddings.pdf",
        "file_size_bytes": 745_900,
        "sections": [
            {
                "title": "HNSW Graph Construction vs IVF Indexing Trade-Offs",
                "page_start": 1,
                "page_end": 7,
                "chunks": [
                    (
                        "Hierarchical Navigable Small World (HNSW) graphs build a multi-layer proximity graph where "
                        "upper layers contain long-range skip links and Layer 0 contains all vectors. Key parameters are "
                        "M (maximum bidirectional links per node, controlling index memory O(M * N) and recall ceiling) "
                        "and efConstruction / efSearch (candidate priority queue width during build and query time)."
                    ),
                    (
                        "Inverted File (IVF) indexes partition the vector space into nlist Voronoi cells via k-means "
                        "clustering and search only the closest nprobe centroids at query time. IVF requires significantly "
                        "less RAM than HNSW but suffers recall degradation when query vectors fall near cell boundaries "
                        "unless nprobe is increased."
                    ),
                ],
            },
            {
                "title": "Hybrid BM25 + Dense Retrieval & Reciprocal Rank Fusion (RRF)",
                "page_start": 8,
                "page_end": 14,
                "chunks": [
                    (
                        "Dense bi-encoder embeddings capture semantic paraphrases and conceptual similarity but frequently "
                        "miss exact identifiers, error codes, function names, and rare acronyms. Lexical BM25 / ts_rank "
                        "retrieval excels at exact token matching. Combining dense and lexical retrieval into a hybrid "
                        "pipeline provides complementary recall across both conceptual and exact-match queries."
                    ),
                    (
                        "Reciprocal Rank Fusion (RRF) merges ranked lists from heterogeneous retrievers without requiring "
                        "score calibration: RRF_score(d) = sum_{r in R} 1 / (k + rank_r(d)), where the smoothing constant "
                        "k (commonly k = 60) damps the influence of outlier top-1 ranks while rewarding documents that "
                        "appear consistently near the top of both semantic and lexical rankings."
                    ),
                ],
            },
        ],
    },
]


def seed_demo_database(
    db: Session,
    offline_embeddings: bool = False,
    allow_non_demo: bool = False,
) -> dict[str, int]:
    settings = get_settings()
    if not settings.is_demo_mode and not allow_non_demo:
        raise RuntimeError(
            f"Refusing to run demo seed because APP_MODE='{settings.app_mode}' is not 'demo'. "
            "Set APP_MODE=demo or pass --allow-non-demo explicitly."
        )

    demo_doc_titles = {doc["title"] for doc in DEMO_DOCUMENTS}
    existing_docs = db.scalars(select(Document)).all()
    non_demo_docs = [d for d in existing_docs if d.title not in demo_doc_titles]
    if non_demo_docs:
        raise RuntimeError(
            "Safety check failed: target database contains non-demo documents "
            f"({len(non_demo_docs)} found). Demo seeding must only run against an isolated demo database."
        )

    # 1. Upsert Demo Project
    project_id = _deterministic_uuid("project.main")
    project = db.scalar(select(Project).where(Project.name == DEMO_PROJECT_NAME))
    if project is None:
        project = Project(
            id=project_id,
            name=DEMO_PROJECT_NAME,
            description=DEMO_PROJECT_DESCRIPTION,
        )
        db.add(project)
        db.flush()

    doc_map: dict[str, Document] = {}
    total_chunks_seeded = 0

    # 2. Upsert Demo Documents, Versions, Sections, Chunks, and Embeddings
    for doc_spec in DEMO_DOCUMENTS:
        doc_key = doc_spec["key"]
        doc = db.scalar(
            select(Document).where(
                Document.project_id == project.id,
                Document.title == doc_spec["title"],
            )
        )
        if doc is None:
            doc = Document(
                id=_deterministic_uuid(f"doc.{doc_key}"),
                project_id=project.id,
                title=doc_spec["title"],
                description=f"Seeded RecallForge AI technical reference for {doc_spec['title']}.",
                document_type="pdf",
            )
            db.add(doc)
            db.flush()

        doc_map[doc_key] = doc

        checksum = hashlib.sha256(f"recallforge-demo:{doc_key}:v1".encode("utf-8")).hexdigest()
        doc_version = db.scalar(
            select(DocumentVersion).where(
                DocumentVersion.document_id == doc.id,
                DocumentVersion.version_number == 1,
            )
        )
        if doc_version is None:
            doc_version = DocumentVersion(
                id=_deterministic_uuid(f"doc_version.{doc_key}.v1"),
                document_id=doc.id,
                version_number=1,
                original_filename=doc_spec["filename"],
                storage_key=f"demo/{project.id}/{doc.id}/v1/{doc_spec['filename']}",
                mime_type="application/pdf",
                file_size_bytes=doc_spec["file_size_bytes"],
                checksum_sha256=checksum,
                processing_status="ready",
            )
            db.add(doc_version)
            db.flush()

        existing_sections = db.scalars(
            select(Section).where(Section.document_version_id == doc_version.id)
        ).all()

        if not existing_sections:
            for sec_idx, sec_spec in enumerate(doc_spec["sections"]):
                section = Section(
                    id=_deterministic_uuid(f"section.{doc_key}.{sec_idx}"),
                    document_version_id=doc_version.id,
                    title=sec_spec["title"],
                    level=1,
                    order_index=sec_idx,
                    page_start=sec_spec["page_start"],
                    page_end=sec_spec["page_end"],
                    raw_text="\n\n".join(sec_spec["chunks"]),
                )
                db.add(section)
                db.flush()

                for chunk_idx, chunk_text in enumerate(sec_spec["chunks"]):
                    chunk = Chunk(
                        id=_deterministic_uuid(f"chunk.{doc_key}.{sec_idx}.{chunk_idx}"),
                        section_id=section.id,
                        chunk_index=chunk_idx,
                        content=chunk_text,
                        chunk_type="text",
                        token_count=len(chunk_text.split()),
                        page_start=sec_spec["page_start"],
                        page_end=sec_spec["page_end"],
                        source_label=f"{doc_spec['title']} — {sec_spec['title']}",
                    )
                    db.add(chunk)
                    db.flush()
                    total_chunks_seeded += 1

                    if offline_embeddings:
                        emb_vec = _deterministic_vector(chunk_text, dims=3072)
                        db.add(
                            ChunkEmbedding(
                                id=_deterministic_uuid(f"emb.{doc_key}.{sec_idx}.{chunk_idx}"),
                                chunk_id=chunk.id,
                                provider="gemini",
                                model=settings.embedding_model,
                                dimensions=len(emb_vec),
                                embedding=emb_vec,
                            )
                        )

        db.flush()

        if not offline_embeddings:
            embed_document_version(db=db, document_version=doc_version, force=False)
        else:
            doc_version.processing_status = "ready"

    now = datetime.now(timezone.utc)

    # 3. Seed Realistic ConceptProgress across all 4 mastery tiers
    progress_specs = [
        {
            "doc_key": "python_dicts_hashability",
            "topic": "Python Dictionaries & Hashability",
            "concept": "python_hash_table_open_addressing",
            "attempts": 3,
            "correct_count": 1,
            "incorrect_count": 2,
            "average_score": 0.44,
            "last_score": 0.45,
            "mastery_level": "weak",
            "last_practiced_at": now - timedelta(days=4),
            "next_review_at": now - timedelta(days=2),
        },
        {
            "doc_key": "vector_search_embeddings",
            "topic": "Vector Search & Embeddings",
            "concept": "hnsw_graph_construction_tradeoffs",
            "attempts": 3,
            "correct_count": 1,
            "incorrect_count": 2,
            "average_score": 0.48,
            "last_score": 0.50,
            "mastery_level": "weak",
            "last_practiced_at": now - timedelta(days=3),
            "next_review_at": now - timedelta(days=1),
        },
        {
            "doc_key": "database_indexing",
            "topic": "Database Indexing",
            "concept": "btree_vs_lsm_write_amplification",
            "attempts": 4,
            "correct_count": 2,
            "incorrect_count": 2,
            "average_score": 0.62,
            "last_score": 0.65,
            "mastery_level": "developing",
            "last_practiced_at": now - timedelta(days=2),
            "next_review_at": now - timedelta(hours=5),
        },
        {
            "doc_key": "rest_api_design",
            "topic": "REST API Design",
            "concept": "http_idempotency_keys_and_retries",
            "attempts": 3,
            "correct_count": 2,
            "incorrect_count": 1,
            "average_score": 0.67,
            "last_score": 0.70,
            "mastery_level": "developing",
            "last_practiced_at": now - timedelta(days=1),
            "next_review_at": now - timedelta(minutes=30),
        },
        {
            "doc_key": "machine_learning_fundamentals",
            "topic": "Machine Learning Fundamentals",
            "concept": "l1_vs_l2_regularization_geometry",
            "attempts": 4,
            "correct_count": 3,
            "incorrect_count": 1,
            "average_score": 0.79,
            "last_score": 0.82,
            "mastery_level": "strong",
            "last_practiced_at": now - timedelta(days=1),
            "next_review_at": now + timedelta(days=2),
        },
        {
            "doc_key": "rest_api_design",
            "topic": "REST API Design",
            "concept": "cursor_vs_offset_pagination",
            "attempts": 3,
            "correct_count": 3,
            "incorrect_count": 0,
            "average_score": 0.83,
            "last_score": 0.85,
            "mastery_level": "strong",
            "last_practiced_at": now - timedelta(hours=18),
            "next_review_at": now + timedelta(days=3),
        },
        {
            "doc_key": "database_indexing",
            "topic": "Database Indexing",
            "concept": "covering_indexes_and_index_only_scans",
            "attempts": 5,
            "correct_count": 5,
            "incorrect_count": 0,
            "average_score": 0.93,
            "last_score": 0.96,
            "mastery_level": "mastered",
            "last_practiced_at": now - timedelta(hours=12),
            "next_review_at": now + timedelta(days=6),
        },
        {
            "doc_key": "vector_search_embeddings",
            "topic": "Vector Search & Embeddings",
            "concept": "reciprocal_rank_fusion_hybrid_search",
            "attempts": 4,
            "correct_count": 4,
            "incorrect_count": 0,
            "average_score": 0.95,
            "last_score": 0.98,
            "mastery_level": "mastered",
            "last_practiced_at": now - timedelta(hours=8),
            "next_review_at": now + timedelta(days=7),
        },
    ]

    for spec in progress_specs:
        doc = doc_map[spec["doc_key"]]
        existing_prog = db.scalar(
            select(ConceptProgress).where(
                ConceptProgress.project_id == project.id,
                ConceptProgress.concept == spec["concept"],
            )
        )
        if existing_prog is None:
            db.add(
                ConceptProgress(
                    id=_deterministic_uuid(f"progress.{spec['concept']}"),
                    project_id=project.id,
                    document_id=doc.id,
                    topic=spec["topic"],
                    concept=spec["concept"],
                    attempts=spec["attempts"],
                    correct_count=spec["correct_count"],
                    incorrect_count=spec["incorrect_count"],
                    average_score=spec["average_score"],
                    last_score=spec["last_score"],
                    mastery_level=spec["mastery_level"],
                    last_practiced_at=spec["last_practiced_at"],
                    next_review_at=spec["next_review_at"],
                )
            )

    db.flush()

    # 4. Seed StudyChallenges, ChallengeAttempts, KnowledgeGaps, and ChallengeAttemptGaps
    gap_challenges = [
        {
            "key": "gap_python_perturb",
            "doc_key": "python_dicts_hashability",
            "topic": "Python Dictionaries & Hashability",
            "concept": "python_hash_table_open_addressing",
            "question": (
                "Explain how Python 3.6+ compact dictionaries resolve hash collisions via open addressing "
                "and why the perturb bit-shift prevents primary clustering."
            ),
            "expected_answer": (
                "Python dicts split storage into a sparse dk_indices array and a dense dk_entries array. "
                "Collisions probe i = (5*i + 1 + perturb) mod mask, shifting perturb right by 5 bits each step "
                "so high-order hash bits influence the probe trajectory, and resize at a 2/3 load factor."
            ),
            "explanation": (
                "Without incorporating high-order bits via perturb, keys with identical low-order bits would "
                "follow the exact same probe sequence."
            ),
            "gap_key": "perturb_high_order_bit_mixing_and_load_factor",
            "gap_display_name": "Perturb High-Order Bit Mixing & 2/3 Resize Threshold",
            "gap_description": (
                "Omitted how shifting perturb by 5 bits mixes high-order hash bits into the probe sequence "
                "and how the 2/3 load-factor threshold bounds probe length."
            ),
            "occurrences": 3,
        },
        {
            "key": "gap_hnsw_memory",
            "doc_key": "vector_search_embeddings",
            "topic": "Vector Search & Embeddings",
            "concept": "hnsw_graph_construction_tradeoffs",
            "question": (
                "How do the HNSW parameters M and efConstruction govern the trade-off between recall@k, "
                "index build time, and RAM consumption?"
            ),
            "expected_answer": (
                "M defines the maximum bidirectional links per node per layer, scaling RAM linearly O(M * N) "
                "while improving graph navigability for high-dimensional vectors. efConstruction controls the "
                "candidate priority queue width during insertion, increasing build time for higher graph quality."
            ),
            "explanation": (
                "Increasing M directly increases memory per vector and internal edge traversal cost, whereas "
                "efSearch can be tuned dynamically at query time."
            ),
            "gap_key": "hnsw_m_degree_memory_scaling",
            "gap_display_name": "HNSW M-Parameter Degree vs RAM Footprint Scaling",
            "gap_description": (
                "Did not account for linear O(M * N) RAM growth from bidirectional edge lists across HNSW layers "
                "when increasing M."
            ),
            "occurrences": 2,
        },
        {
            "key": "gap_btree_lsm",
            "doc_key": "database_indexing",
            "topic": "Database Indexing",
            "concept": "btree_vs_lsm_write_amplification",
            "question": (
                "Compare write amplification and range-query read amplification between B-Tree indexes "
                "and Log-Structured Merge-trees (LSM-trees)."
            ),
            "expected_answer": (
                "B-Trees update 8 KB pages in place and write full page images to WAL, causing higher random "
                "write amplification, but offer fast O(log N) point and range reads. LSM-trees buffer writes "
                "in a MemTable and flush sequential SSTables, reducing random write I/O at the cost of checking "
                "multiple SSTable levels and running background compaction."
            ),
            "explanation": (
                "B-Trees optimize read latency via a single sorted tree, while LSM-trees optimize write throughput "
                "via sequential appends."
            ),
            "gap_key": "lsm_compaction_and_read_amplification",
            "gap_display_name": "LSM-Tree Multi-SSTable Read Amplification & Compaction",
            "gap_description": (
                "Overlooked how range queries in LSM-trees must merge-scan across MemTable and multiple SSTable "
                "levels when compaction lags behind write bursts."
            ),
            "occurrences": 2,
        },
        {
            "key": "gap_idempotency_conflict",
            "doc_key": "rest_api_design",
            "topic": "REST API Design",
            "concept": "http_idempotency_keys_and_retries",
            "question": (
                "How should a REST API server handle concurrent duplicate POST requests that arrive with "
                "the same Idempotency-Key while the initial request is still executing?"
            ),
            "expected_answer": (
                "The server must atomically insert or lock the (client_id, idempotency_key) record before "
                "executing side effects, returning HTTP 409 Conflict (or awaiting completion) for in-flight "
                "duplicates and HTTP 422 if the request payload hash mismatches the original request."
            ),
            "explanation": (
                "Checking the idempotency table without atomic locking or payload hash verification allows "
                "race-condition double execution."
            ),
            "gap_key": "idempotency_in_flight_locking_and_payload_hash",
            "gap_display_name": "In-Flight Idempotency Locking & Payload Hash Validation",
            "gap_description": (
                "Missed atomic in-flight lock handling (HTTP 409) and payload SHA-256 fingerprint verification "
                "(HTTP 422) when reusing an Idempotency-Key."
            ),
            "occurrences": 1,
        },
    ]

    for item in gap_challenges:
        doc = doc_map[item["doc_key"]]
        challenge_id = _deterministic_uuid(f"challenge.{item['key']}")
        challenge = db.get(StudyChallenge, challenge_id)
        if challenge is None:
            challenge = StudyChallenge(
                id=challenge_id,
                project_id=project.id,
                document_id=doc.id,
                topic=item["topic"],
                concept=item["concept"],
                question=item["question"],
                expected_answer=item["expected_answer"],
                explanation=item["explanation"],
                status="active",
            )
            db.add(challenge)
            db.flush()

        gap_id = _deterministic_uuid(f"gap.{item['key']}")
        gap = db.get(KnowledgeGap, gap_id)
        if gap is None:
            gap = KnowledgeGap(
                id=gap_id,
                project_id=project.id,
                document_id=doc.id,
                concept=item["concept"],
                gap_key=item["gap_key"],
                display_name=item["gap_display_name"],
                description=item["gap_description"],
            )
            db.add(gap)
            db.flush()

        for occ_idx in range(item["occurrences"]):
            attempt_id = _deterministic_uuid(f"attempt.{item['key']}.{occ_idx}")
            attempt = db.get(ChallengeAttempt, attempt_id)
            if attempt is None:
                attempt = ChallengeAttempt(
                    id=attempt_id,
                    challenge_id=challenge.id,
                    user_answer="Partial explanation focusing on high-level behavior without memory/concurrency bounds.",
                    score=0.55,
                    correct=False,
                    feedback=f"Good start, but missed: {item['gap_display_name']}.",
                    missing_points=json.dumps([item["gap_description"]]),
                    created_at=now - timedelta(days=occ_idx + 1),
                )
                db.add(attempt)
                db.flush()

                db.add(
                    ChallengeAttemptGap(
                        id=_deterministic_uuid(f"attempt_gap.{item['key']}.{occ_idx}"),
                        attempt_id=attempt.id,
                        knowledge_gap_id=gap.id,
                        raw_missing_point=item["gap_description"],
                        created_at=now - timedelta(days=occ_idx + 1),
                    )
                )

    db.commit()

    return {
        "documents": len(DEMO_DOCUMENTS),
        "chunks_seeded": total_chunks_seeded,
        "concepts": len(progress_specs),
        "knowledge_gaps": len(gap_challenges),
    }


def reset_and_seed_demo_database(
    db: Session,
    offline_embeddings: bool = False,
) -> dict[str, int | bool]:
    """
    Safely resets ONLY the canonical demo project entities and re-seeds the demo database.
    Explicit Demo Reset Safety Model:
    1. APP_MODE must equal 'demo' (Personal Mode always rejected).
    2. DEMO_RESET_ALLOWED must be explicitly set to 'true'.
    3. Canonical Demo data identity check: refuses if any non-demo Project or Document exists.
    4. Scoped deletion of only the canonical demo project (never generic TRUNCATE/DROP).
    """
    settings = get_settings()
    if not settings.is_demo_mode:
        raise RuntimeError(
            f"Refusing to reset demo database because APP_MODE='{settings.app_mode}' is not 'demo'."
        )

    if not settings.demo_reset_allowed:
        raise RuntimeError(
            "Refusing to reset demo database because DEMO_RESET_ALLOWED is not 'true'. "
            "Set DEMO_RESET_ALLOWED=true to explicitly authorize demo database reset."
        )

    existing_projects = db.scalars(select(Project)).all()
    non_demo_projects = [
        p for p in existing_projects if p.name != DEMO_PROJECT_NAME
    ]
    if non_demo_projects:
        raise RuntimeError(
            "Safety check failed: target database contains non-demo projects "
            f"({[p.name for p in non_demo_projects]}). Aborting demo reset."
        )

    demo_doc_titles = {doc["title"] for doc in DEMO_DOCUMENTS}
    existing_docs = db.scalars(select(Document)).all()
    non_demo_docs = [d for d in existing_docs if d.title not in demo_doc_titles]
    if non_demo_docs:
        raise RuntimeError(
            "Safety check failed: target database contains non-demo documents "
            f"({len(non_demo_docs)} found). Aborting demo reset."
        )

    demo_project = db.scalar(
        select(Project).where(Project.name == DEMO_PROJECT_NAME)
    )
    if demo_project is not None:
        # Scoped deletion of only the demo project (cascades to demo documents, versions, sections, chunks, embeddings, challenges, attempts, progress, and gaps)
        db.delete(demo_project)
        db.commit()

    seeded = seed_demo_database(
        db=db,
        offline_embeddings=offline_embeddings,
        allow_non_demo=False,
    )
    return {
        "reset": True,
        **seeded,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed or reset isolated RecallForge AI Public Demo database."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Safely reset only canonical demo project records and re-seed (requires APP_MODE=demo and DEMO_RESET_ALLOWED=true).",
    )
    parser.add_argument(
        "--offline-embeddings",
        action="store_true",
        help="Use deterministic synthetic vectors instead of calling Gemini API.",
    )
    parser.add_argument(
        "--allow-non-demo",
        action="store_true",
        help="Allow initial seed even if APP_MODE is not set to 'demo' (still blocks if non-demo documents exist).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db:
        if args.reset:
            summary = reset_and_seed_demo_database(
                db=db,
                offline_embeddings=args.offline_embeddings,
            )
        else:
            summary = seed_demo_database(
                db=db,
                offline_embeddings=args.offline_embeddings,
                allow_non_demo=args.allow_non_demo,
            )
        print("Demo seed complete:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
