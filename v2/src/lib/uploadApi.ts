import type { DashboardData } from '@/types'

// server.py — a local-only companion process, started separately (`python3 server.py`).
// Only ever reachable from this machine; see v2/README.md.
const API_BASE = 'http://localhost:8787'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export type JobStatus = {
  status: 'queued' | 'detecting' | 'checking_ollama' | 'parsing' | 'classifying' | 'done' | 'error'
  processed: number
  total: number
  owner: string | null
  message: string
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

/** Server is unreachable — most likely `python3 server.py` isn't running. Distinguished
 * from an in-job error so the UI can say so specifically rather than a generic failure. */
export class UploadServerUnreachableError extends Error {}

async function postFile(path: string, file: File): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, { method: 'POST', body: file })
  } catch {
    throw new UploadServerUnreachableError(
      "Can't reach the local upload server. Run `python3 server.py` in the v2 directory.",
    )
  }
}

/** Fast and synchronous — a regex pass over a row sample, no Ollama call — so the caller
 * can show the guessed owner name for editing before any job starts. */
export async function detectOwner(file: File): Promise<string | null> {
  const res = await postFile('/api/detect-owner', file)
  if (!res.ok) throw new Error(await errorMessage(res))
  const body = (await res.json()) as { owner: string | null }
  return body.owner
}

export async function startUpload(file: File, owner: string): Promise<string> {
  const res = await postFile(`/api/upload?owner=${encodeURIComponent(owner)}`, file)
  if (!res.ok) throw new Error(await errorMessage(res))
  const body = (await res.json()) as { job_id: string }
  return body.job_id
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`)
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<JobStatus>
}

export async function fetchData(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/api/data`)
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.json() as Promise<DashboardData>
}
