import {
  DocumentListResponse,
  ProjectListResponse,
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
