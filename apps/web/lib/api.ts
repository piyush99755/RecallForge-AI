import { ReviewQueueResponse } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8001";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetches the current learner review queue from FastAPI endpoint GET /learning/review-queue
 */
export async function getReviewQueue(
  projectId?: string,
  documentId?: string
): Promise<ReviewQueueResponse> {
  const url = new URL(`${API_BASE_URL}/learning/review-queue`);
  if (projectId) url.searchParams.set("project_id", projectId);
  if (documentId) url.searchParams.set("document_id", documentId);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch review queue (${response.status}: ${response.statusText})`,
      response.status
    );
  }

  return response.json();
}
