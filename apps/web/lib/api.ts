import {
  AppMode,
  AskRequest,
  AskResponse,
  AuthModeResponse,
  ChallengeEvaluationRequest,
  ChallengeEvaluationResponse,
  ChallengeRequest,
  ChallengeResponse,
  DeleteDocumentResponse,
  DemoSessionResponse,
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
export const DEMO_ACCESS_TOKEN_STORAGE_KEY = "recallforge_demo_access_token";
export const AUTH_STATE_CHANGE_EVENT = "recallforge:auth-change";

const ENV_APP_MODE: AppMode =
  process.env.NEXT_PUBLIC_APP_MODE?.trim().toLowerCase() === "demo"
    ? "demo"
    : "personal";

let runtimeAppMode: AppMode = ENV_APP_MODE;

export function getActiveAppMode(): AppMode {
  return runtimeAppMode;
}

export function setActiveAppMode(mode: AppMode): void {
  runtimeAppMode = mode === "demo" ? "demo" : "personal";
}

export function isDemoModeActive(): boolean {
  return runtimeAppMode === "demo";
}

function getStorageKeyForCurrentMode(): string {
  return runtimeAppMode === "demo"
    ? DEMO_ACCESS_TOKEN_STORAGE_KEY
    : ACCESS_TOKEN_STORAGE_KEY;
}

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

export const DEMO_SESSION_EXPIRED_MESSAGE =
  "Demo session expired — start a new session.";

function isDemoTokenExpired(token: string): boolean {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "rfdemo") {
    return true;
  }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const jsonStr = window.atob(padded);
    const claims = JSON.parse(jsonStr) as { exp?: number; mode?: string };
    if (claims.mode !== "demo" || typeof claims.exp !== "number") {
      return true;
    }
    return Date.now() >= claims.exp * 1000;
  } catch {
    return true;
  }
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const key = getStorageKeyForCurrentMode();
    const token = window.localStorage.getItem(key);
    const cleaned = token && token.trim() ? token.trim() : null;
    if (!cleaned) {
      return null;
    }
    if (runtimeAppMode === "demo" && isDemoTokenExpired(cleaned)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return cleaned;
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
  window.localStorage.setItem(getStorageKeyForCurrentMode(), cleaned);
  window.dispatchEvent(
    new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
      detail: { authenticated: true, appMode: runtimeAppMode },
    })
  );
}

export function clearStoredAccessToken(reason?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getStorageKeyForCurrentMode());
  window.dispatchEvent(
    new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
      detail: { authenticated: false, reason, appMode: runtimeAppMode },
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

  let token: string | null = null;
  if (customToken !== undefined) {
    token = customToken.trim();
  } else {
    const rawStored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(getStorageKeyForCurrentMode())
        : null;
    if (
      runtimeAppMode === "demo" &&
      rawStored &&
      isDemoTokenExpired(rawStored)
    ) {
      clearStoredAccessToken(DEMO_SESSION_EXPIRED_MESSAGE);
      throw new ApiError(DEMO_SESSION_EXPIRED_MESSAGE, 401);
    }
    token = getStoredAccessToken();
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401 && customToken === undefined) {
    const detail = await parseErrorDetail(response);
    const friendlyReason =
      runtimeAppMode === "demo" ? DEMO_SESSION_EXPIRED_MESSAGE : detail;
    clearStoredAccessToken(friendlyReason);
    throw new ApiError(friendlyReason, 401);
  }

  return response;
}

/**
 * Fetches the backend's current operating mode (personal vs demo).
 */
export async function getAuthMode(): Promise<AuthModeResponse> {
  try {
    const baseUrl = resolveApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/mode`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        app_mode: ENV_APP_MODE,
        demo_enabled: ENV_APP_MODE === "demo",
        uploads_enabled: ENV_APP_MODE !== "demo",
        deletions_enabled: ENV_APP_MODE !== "demo",
      };
    }
    const data: AuthModeResponse = await response.json();
    setActiveAppMode(data.app_mode);
    return data;
  } catch {
    return {
      app_mode: ENV_APP_MODE,
      demo_enabled: ENV_APP_MODE === "demo",
      uploads_enabled: ENV_APP_MODE !== "demo",
      deletions_enabled: ENV_APP_MODE !== "demo",
    };
  }
}

/**
 * Requests a demo session token from POST /auth/demo-session (available only when backend APP_MODE='demo').
 */
export async function startDemoSession(): Promise<DemoSessionResponse> {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/auth/demo-session`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(detail, response.status);
  }

  const data: DemoSessionResponse = await response.json();
  setActiveAppMode("demo");
  setStoredAccessToken(data.access_token);
  return data;
}

/**
 * Verifies a personal or demo access token against GET /auth/verify before persisting.
 */
export async function verifyAccessToken(token: string): Promise<boolean> {
  const cleaned = token.trim();
  if (!cleaned) {
    throw new ApiError("Please enter an access token.", 400);
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
