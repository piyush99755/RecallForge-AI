export type MasteryLevel = "weak" | "developing" | "strong" | "mastered";
export type ReviewStatus = "due" | "scheduled" | "new" | string;

export interface LearningProgressSummary {
  total_concepts: number;
  weak_count: number;
  developing_count: number;
  strong_count: number;
  mastered_count: number;
}

export interface RecommendedConcept {
  topic: string;
  concept: string;
  average_score: number;
  mastery_level: MasteryLevel;
  attempts: number;
  priority_score: number;
  reason: string;
}

export interface LearningProgressItem {
  topic: string;
  concept: string;
  attempts: number;
  average_score: number;
  last_score: number;
  correct_count: number;
  incorrect_count: number;
  mastery_level: MasteryLevel;
  next_review_at: string | null;
  review_status: ReviewStatus;
}

export interface LearningProgressResponse {
  summary: LearningProgressSummary;
  recommended_next_concepts: RecommendedConcept[];
  items: LearningProgressItem[];
}

export interface ReviewQueueGap {
  gap_key: string;
  display_name: string;
  occurrences: number;
}

export interface ReviewQueueItem {
  project_id: string | null;
  document_id: string | null;
  topic: string;
  concept: string;
  attempts: number;
  average_score: number;
  mastery_level: MasteryLevel;
  next_review_at: string | null;
  review_status: ReviewStatus;
  priority_score: number;
  reason: string;
  top_gap: ReviewQueueGap | null;
}

export interface ReviewQueueResponse {
  total_items: number;
  items: ReviewQueueItem[];
}

export interface KnowledgeGapItem {
  concept: string;
  topic: string;
  gap_key: string;
  display_name: string;
  description: string;
  occurrences: number;
}

export interface KnowledgeGapResponse {
  total_gaps: number;
  items: KnowledgeGapItem[];
}
