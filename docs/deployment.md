# RecallForge AI — Cloud Deployment & Security Guide (Milestone 2)

This guide covers deploying RecallForge AI to the public internet for **personal use** using **Supabase** (PostgreSQL + pgvector + private Storage), **Render** (or **Railway**) for the FastAPI backend, and **Vercel** for the Next.js frontend.

---

## 1. Architecture Overview

- **Database:** Supabase PostgreSQL with `pgvector`
- **Document Storage:** Configurable via `STORAGE_BACKEND`:
  - `local` (default for local development): stores PDFs in `apps/api/uploads/{project_id}/{document_id}/v{version}/{filename}`
  - `supabase` (recommended for production): stores PDFs in a **private** Supabase Storage bucket (`documents`) under object key `{project_id}/{document_id}/v{version}/{filename}`
- **Backend API:** FastAPI (`apps/api`) containerized via `apps/api/Dockerfile`, protected by a personal Bearer token (`API_ACCESS_TOKEN`)
- **Frontend Web App:** Next.js 15 (`apps/web`) deployed to Vercel, communicating directly with FastAPI using `NEXT_PUBLIC_API_BASE_URL` and `Authorization: Bearer <token>`

> **Note on Existing Local Documents:** Existing PDFs in your local `apps/api/uploads/` folder are not automatically migrated to cloud storage and remain readable locally. All new uploads when `STORAGE_BACKEND=supabase` are stored in your private Supabase Storage bucket so they survive container restarts and redeployments.

---

## 2. Supabase Setup (Database & Private Storage Bucket)

### 2.1 Verify Database Active Status & Connection String
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and verify your project is **Active** (if paused due to free-tier inactivity, click **Restore / Unpause project**).
2. Go to **Project Settings → Database → Connection string** and copy the **Session Pooler** (port `5432`) URI.
3. Ensure the scheme is `postgresql+psycopg://` for SQLAlchemy 2.0 + `psycopg` v3:
   ```text
   postgresql+psycopg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

### 2.2 Create Private Storage Bucket
1. In the Supabase Dashboard, open **Storage → New Bucket**.
2. Set bucket name: `documents`
3. Keep **Public bucket** turned **OFF** (Private).
4. Copy your project URL and Service Role key from **Project Settings → API**:
   - `SUPABASE_URL=https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>` *(Backend-only! Never expose to Next.js or `NEXT_PUBLIC_*`)*

---

## 3. FastAPI Backend Deployment (Render Recommended, or Railway)

### 3.1 Primary Recommendation: Render Web Service (Docker)
1. In Render, click **New + → Web Service** and connect your GitHub repository.
2. Configure service settings:
   - **Root Directory:** `apps/api`
   - **Runtime:** `Docker` (uses `apps/api/Dockerfile`)
   - **Health Check Path:** `/health`
3. Alternatively, if deploying via **Native Python** (without Docker) on Render or Railway:
   - **Root Directory:** `apps/api`
   - **Python Version:** `3.11` or `3.12`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`

### 3.2 Required Backend Environment Variables
Configure the following environment variables in Render / Railway (never commit real values to Git):

| Variable | Example / Description |
| :--- | :--- |
| `APP_NAME` | `RecallForge AI API` |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `DATABASE_URL` | `postgresql+psycopg://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `EMBEDDING_MODEL` | `gemini-embedding-001` (also accepts legacy `GEMINI_EMBEDDING_MODEL`) |
| `RERANKER_MODEL` | `gemini-3.6-flash` |
| `API_ACCESS_TOKEN` | Strong random secret (e.g. `openssl rand -hex 32`). **Required when `APP_ENV=production`**. |
| `CORS_ORIGINS` | `https://your-project.vercel.app,http://localhost:3000` (comma-separated, no trailing slash, no `*`) |
| `STORAGE_BACKEND` | `supabase` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` secret key |
| `SUPABASE_STORAGE_BUCKET` | `documents` |

### 3.3 Database Migrations (Alembic)
Migrations are **not** run automatically on every container boot to avoid accidental schema locks or destructive operations during scaling/restarts. Run migrations manually when deploying schema changes:
```bash
cd apps/api
alembic upgrade head
```

---

## 4. Next.js Frontend Deployment (Vercel)

1. In Vercel, click **Add New → Project** and import your GitHub repository.
2. Configure build settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `apps/web`
3. Add Environment Variable in Vercel:
   - `NEXT_PUBLIC_API_BASE_URL=https://your-recallforge-api.onrender.com` *(no trailing slash)*
4. Deploy the project.
5. Once Vercel assigns your production domain (e.g. `https://recall-forge-ai.vercel.app`), update `CORS_ORIGINS` on your FastAPI backend service to include that exact origin and redeploy/restart the backend.

---

## 5. Personal Access Gate & Token Rotation

### 5.1 How Personal Auth Works
- Every backend route except `GET /health` requires `Authorization: Bearer <API_ACCESS_TOKEN>`.
- When you open the RecallForge web app on a new browser or phone, the **Personal Study Engine Access** screen prompts you for your `API_ACCESS_TOKEN`.
- The token is verified against `GET /auth/verify` using constant-time comparison (`secrets.compare_digest`) and stored in browser `localStorage` (`recallforge_access_token`).
- Clicking **Forget Device** in the top navigation bar clears `localStorage` and immediately locks the UI back to the access screen.
- *Security Note:* Browser `localStorage` with a shared personal Bearer token is designed for a **single-user personal study MVP** and future personal PWA/Capacitor APK usage. A public multi-user SaaS deployment would require per-user OAuth/JWT sessions and row-level tenancy.

### 5.2 Rotating Your Personal Token
1. Generate a new secret token (`openssl rand -hex 32`).
2. Update `API_ACCESS_TOKEN` in Render/Railway (or `apps/api/.env` locally) and restart the backend.
3. Existing browser sessions will automatically detect the `401 Unauthorized` response on their next API call, clear the stale token, and prompt you to enter the new token.

---

## 6. Post-Deployment Smoke Test Checklist

1. **Public Health Check:**
   ```bash
   curl -i https://your-recallforge-api.onrender.com/health
   ```
   - Expect `200 OK` with `{"status":"ok","database":"connected"}`.
2. **Unauthenticated Route Rejection:**
   ```bash
   curl -i https://your-recallforge-api.onrender.com/documents
   ```
   - Expect `401 Unauthorized`.
3. **Authenticated Route Access:**
   ```bash
   curl -i -H "Authorization: Bearer <YOUR_TOKEN>" https://your-recallforge-api.onrender.com/documents
   ```
   - Expect `200 OK`.
4. **Frontend Access Flow:**
   - Open your Vercel URL in an incognito window.
   - Confirm the **Personal Study Engine Access** prompt appears.
   - Enter an invalid token $\rightarrow$ confirm `401` error message is shown.
   - Enter your valid `API_ACCESS_TOKEN` $\rightarrow$ confirm Dashboard loads live mastery, gaps, and review queue.
5. **Cloud Storage Lifecycle:**
   - In **Library**, upload a small disposable PDF.
   - Confirm object `{project_id}/{document_id}/v1/{filename}` appears in your private Supabase `documents` bucket and reaches `ready` status.
   - Ask a grounded question in **Ask RecallForge** and verify citations.
   - Delete the disposable document from **Library** and confirm both the DB rows and the Supabase Storage object are removed.
6. **Forget Device:**
   - Click **Forget Device** in the top bar $\rightarrow$ confirm the app immediately returns to the access prompt.
