import {
  AskRequest,
  AskResponse,
  ChallengeEvaluationRequest,
  ChallengeEvaluationResponse,
  ChallengeRequest,
  ChallengeResponse,
  DocumentListResponse,
  KnowledgeGapResponse,
  LearningProgressResponse,
  ProjectListResponse,
  ReviewNextRequest,
  ReviewQueueResponse,
  UploadDocumentResponse,
} from "./types";

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
 * Fetches the list of available projects from FastAPI endpoint GET /projects
 */
export async function getProjects(): Promise<ProjectListResponse> {
  const url = `${API_BASE_URL}/projects`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch projects (${response.status}: ${response.statusText})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetches documents from FastAPI endpoint GET /documents
 * Accepts an optional project_id UUID query parameter
 */
export async function getDocuments(
  projectId?: string
): Promise<DocumentListResponse> {
  const url = new URL(`${API_BASE_URL}/documents`);
  if (projectId && projectId !== "all") {
    url.searchParams.set("project_id", projectId);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(
      `Failed to fetch documents (${response.status}: ${response.statusText})`,
      response.status
    );
  }

  return response.json();
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

/**
 * Uploads a document to FastAPI endpoint POST /documents/upload
 * Requires FormData fields: title (string), file (PDF UploadFile), optional project_id (UUID)
 */
export async function uploadDocument(
  formData: FormData
): Promise<UploadDocumentResponse> {
  const url = `${API_BASE_URL}/documents/upload`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    // Note: Do NOT set Content-Type header when sending FormData!
    // The browser sets multipart/form-data with proper boundary automatically.
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors for non-JSON response body
    }

    throw new ApiError(
      `Document upload failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Sends a grounded Q&A prompt to FastAPI endpoint POST /ask
 */
export async function askRecallForge(
  payload: AskRequest
): Promise<AskResponse> {
  const url = `${API_BASE_URL}/ask`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors for non-JSON response body
    }

    throw new ApiError(
      `Ask request failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetches the learner's overall progress from FastAPI endpoint GET /learning/progress
 */
export async function getLearningProgress(
  projectId?: string,
  documentId?: string
): Promise<LearningProgressResponse> {
  const url = new URL(`${API_BASE_URL}/learning/progress`);
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
      `Failed to fetch learning progress (${response.status}: ${response.statusText})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetches the recurring knowledge gaps from FastAPI endpoint GET /learning/gaps
 */
export async function getKnowledgeGaps(
  projectId?: string,
  documentId?: string
): Promise<KnowledgeGapResponse> {
  const url = new URL(`${API_BASE_URL}/learning/gaps`);
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
      `Failed to fetch knowledge gaps (${response.status}: ${response.statusText})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Generates the next prioritized review challenge from FastAPI endpoint POST /learning/review-next
 */
export async function getNextReviewChallenge(
  payload?: ReviewNextRequest
): Promise<ChallengeResponse> {
  const url = `${API_BASE_URL}/learning/review-next`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new ApiError(
      `Review challenge generation failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Generates a regular diagnostic technical challenge from FastAPI endpoint POST /challenge
 */
export async function generateChallenge(
  payload: ChallengeRequest
): Promise<ChallengeResponse> {
  const url = `${API_BASE_URL}/challenge`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new ApiError(
      `Challenge generation failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Evaluates a learner's answer against a challenge from FastAPI endpoint POST /challenge/evaluate
 */
export async function evaluateChallenge(
  payload: ChallengeEvaluationRequest
): Promise<ChallengeEvaluationResponse> {
  const url = `${API_BASE_URL}/challenge/evaluate`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail =
          typeof errJson.detail === "string"
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new ApiError(
      `Challenge evaluation failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}
