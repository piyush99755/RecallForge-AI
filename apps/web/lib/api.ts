import {
  AskRequest,
  AskResponse,
  ChallengeEvaluationRequest,
  ChallengeEvaluationResponse,
  ChallengeRequest,
  ChallengeResponse,
  DeleteDocumentResponse,
  DocumentListResponse,
  KnowledgeGapResponse,
  LearningProgressResponse,
  ProjectListResponse,
  RetryDocumentVersionResponse,
  ReviewNextRequest,
  ReviewQueueResponse,
  UploadDocumentResponse,
} from "./types";

export const ACCESS_TOKEN_STORAGE_KEY = "recallforge_access_token";
export const AUTH_STATE_CHANGE_EVENT = "recallforge:auth-change";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Resolves the backend API base URL.
 * - In production, NEXT_PUBLIC_API_BASE_URL is required (fails with a clear configuration error if missing).
 * - In development, defaults to http://127.0.0.1:8001 if unset.
 */
export function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(
    /\/+$/,
    ""
  );
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(
      "Backend API URL is not configured. Set NEXT_PUBLIC_API_BASE_URL in your deployment environment.",
      500
    );
  }
  return "http://127.0.0.1:8001";
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return token && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const cleaned = token.trim();
  if (!cleaned) {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, cleaned);
  window.dispatchEvent(
    new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
      detail: { authenticated: true },
    })
  );
}

export function clearStoredAccessToken(reason?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
      detail: { authenticated: false, reason },
    })
  );
}

async function parseErrorDetail(response: Response): Promise<string> {
  let errorDetail = response.statusText || `HTTP ${response.status}`;
  try {
    const errJson = await response.json();
    if (errJson?.detail) {
      errorDetail =
        typeof errJson.detail === "string"
          ? errJson.detail
          : JSON.stringify(errJson.detail);
    }
  } catch {
    // Ignore JSON parse errors for non-JSON responses
  }
  return errorDetail;
}

async function apiFetch(
  pathOrUrl: string,
  init: RequestInit = {},
  customToken?: string
): Promise<Response> {
  const baseUrl = resolveApiBaseUrl();
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const token = customToken !== undefined ? customToken.trim() : getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401 && customToken === undefined) {
    const detail = await parseErrorDetail(response);
    clearStoredAccessToken(detail);
    throw new ApiError(detail, 401);
  }

  return response;
}

/**
 * Verifies a personal access token against GET /auth/verify before persisting.
 */
export async function verifyAccessToken(token: string): Promise<boolean> {
  const cleaned = token.trim();
  if (!cleaned) {
    throw new ApiError("Please enter a personal access token.", 400);
  }

  const response = await apiFetch(
    "/auth/verify",
    { cache: "no-store" },
    cleaned
  );

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(detail, response.status);
  }

  return true;
}

/**
 * Fetches the list of available projects from FastAPI endpoint GET /projects
 */
export async function getProjects(): Promise<ProjectListResponse> {
  const response = await apiFetch("/projects", {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Failed to fetch projects (${response.status}: ${errorDetail})`,
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
  const params = new URLSearchParams();
  if (projectId && projectId !== "all") {
    params.set("project_id", projectId);
  }
  const query = params.toString();
  const response = await apiFetch(`/documents${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Failed to fetch documents (${response.status}: ${errorDetail})`,
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
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (documentId) params.set("document_id", documentId);
  const query = params.toString();

  const response = await apiFetch(
    `/learning/review-queue${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Failed to fetch review queue (${response.status}: ${errorDetail})`,
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
  const response = await apiFetch("/documents/upload", {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type header when sending FormData; browser sets boundary automatically.
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Document upload failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Deletes a document from FastAPI endpoint DELETE /documents/{document_id}
 */
export async function deleteDocument(
  documentId: string
): Promise<DeleteDocumentResponse> {
  const response = await apiFetch(
    `/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Document deletion failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}

/**
 * Retries processing for a failed document version via POST /documents/versions/{document_version_id}/retry
 */
export async function retryDocumentVersion(
  documentVersionId: string
): Promise<RetryDocumentVersionResponse> {
  const response = await apiFetch(
    `/documents/versions/${encodeURIComponent(documentVersionId)}/retry`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Document retry failed (${response.status}: ${errorDetail})`,
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
  const response = await apiFetch("/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
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
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (documentId) params.set("document_id", documentId);
  const query = params.toString();

  const response = await apiFetch(
    `/learning/progress${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Failed to fetch learning progress (${response.status}: ${errorDetail})`,
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
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (documentId) params.set("document_id", documentId);
  const query = params.toString();

  const response = await apiFetch(
    `/learning/gaps${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Failed to fetch knowledge gaps (${response.status}: ${errorDetail})`,
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
  const response = await apiFetch("/learning/review-next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
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
  const response = await apiFetch("/challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
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
  const response = await apiFetch("/challenge/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorDetail = await parseErrorDetail(response);
    throw new ApiError(
      `Challenge evaluation failed (${response.status}: ${errorDetail})`,
      response.status
    );
  }

  return response.json();
}
