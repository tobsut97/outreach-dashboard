import { get, put } from '@vercel/blob'

// Edge runtime, not the default Node serverless runtime, so this handler receives a Fetch API
// Request (with .json()) rather than a classic Node (req, res) pair — the Node runtime's req
// has no .json() method and PUT/POST would 500 on request.json().
export const config = { runtime: 'edge' }

const BLOB_PATHNAME = 'overrides.json'

interface ConversationOverride {
  sentiment?: string
  tags?: string[]
  irrelevant?: boolean
}

type Overrides = Record<string, ConversationOverride>

function isValidOverrides(value: unknown): value is Overrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((override) => {
    if (typeof override !== 'object' || override === null) return false
    const { sentiment, tags, irrelevant } = override as Record<string, unknown>
    return (
      (sentiment === undefined || typeof sentiment === 'string') &&
      (tags === undefined || (Array.isArray(tags) && tags.every((tag) => typeof tag === 'string'))) &&
      (irrelevant === undefined || typeof irrelevant === 'boolean')
    )
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    try {
      const blob = await get(BLOB_PATHNAME, { access: 'private' })
      if (!blob) return Response.json({})
      const overrides = await new Response(blob.stream).json()
      return Response.json(overrides)
    } catch {
      // No blob written yet — nothing overridden so far.
      return Response.json({})
    }
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (!isValidOverrides(body)) {
      return new Response('Invalid overrides payload', { status: 400 })
    }
    await put(BLOB_PATHNAME, JSON.stringify(body), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return new Response(null, { status: 204 })
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, PUT, POST' } })
}
