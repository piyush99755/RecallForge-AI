import {
  LearningProgressSummary,
  ReviewQueueItem,
  KnowledgeGapItem,
} from "./types";

export const MOCK_SUMMARY: LearningProgressSummary = {
  total_concepts: 18,
  weak_count: 3,
  developing_count: 6,
  strong_count: 5,
  mastered_count: 4,
};

export const MOCK_NEXT_REVIEW: ReviewQueueItem = {
  project_id: "p1-core-python",
  document_id: "doc-python-advanced",
  topic: "Data Structures & Hashing",
  concept: "Hashable Object Mutation",
  attempts: 4,
  average_score: 0.45,
  mastery_level: "developing",
  next_review_at: "2026-09-23T10:00:00Z",
  review_status: "due",
  priority_score: 0.92,
  reason: "Review interval elapsed; target gap requires immediate reinforcement.",
  top_gap: {
    gap_key: "mutation_alters_hash",
    display_name: "Mutation Alters Hash Value or Equality",
    occurrences: 4,
  },
};

export const MOCK_KNOWLEDGE_GAPS: KnowledgeGapItem[] = [
  {
    concept: "Hashable Object Mutation",
    topic: "Data Structures & Hashing",
    gap_key: "mutation_alters_hash",
    display_name: "Mutation Alters Hash Value or Equality",
    description:
      "Mutating internal attributes of custom objects after inserting them into sets or dicts invalidates hash lookup integrity.",
    occurrences: 4,
  },
  {
    concept: "AsyncIO Task Scheduling",
    topic: "Async Execution",
    gap_key: "blocking_loop_thread",
    display_name: "Blocking I/O Calls inside Event Loop",
    description:
      "Executing synchronous file or network calls in async handlers starves the looper and delays pending tasks.",
    occurrences: 3,
  },
];

export const MOCK_REVIEW_QUEUE: ReviewQueueItem[] = [
  MOCK_NEXT_REVIEW,
  {
    project_id: "p1-core-python",
    document_id: "doc-concurrency",
    topic: "Concurrency & Memory",
    concept: "GIL Thread Lock Contention",
    attempts: 3,
    average_score: 0.38,
    mastery_level: "weak",
    next_review_at: "2026-09-23T08:30:00Z",
    review_status: "due",
    priority_score: 0.85,
    reason: "Low accuracy on last 2 challenge attempts",
    top_gap: {
      gap_key: "cpu_bound_threading",
      display_name: "Confusing CPU-bound threading with multi-core parallelism",
      occurrences: 3,
    },
  },
  {
    project_id: "p2-db-systems",
    document_id: "doc-postgres-internals",
    topic: "Database Internals",
    concept: "B-Tree Indexing Scans",
    attempts: 7,
    average_score: 0.78,
    mastery_level: "strong",
    next_review_at: "2026-09-24T14:00:00Z",
    review_status: "scheduled",
    priority_score: 0.42,
    reason: "Periodic spaced repetition check",
    top_gap: null,
  },
];
