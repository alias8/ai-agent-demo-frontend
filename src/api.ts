import type { Persona } from './personas.ts'

/** One attempt at one tool call. A retried call has several, sharing a tool_call_id. */
export interface ToolCallEntry {
  type: 'tool_call'
  timestamp: string
  iteration: number
  tool_call_id: string | null
  tool: string
  input: Record<string, unknown>
  duration_ms: number
  success: boolean
  attempts: number
  output: string | null
  error_type: string | null
}

export interface FinalAnswerEntry {
  type: 'final_answer'
  timestamp: string
  iteration: number
  text: string
}

export interface OtherEntry {
  type: 'max_iterations' | 'api_error' | 'tool_retry' | 'loop_detected'
  timestamp: string
  [key: string]: unknown
}

export type TraceEntry = ToolCallEntry | FinalAnswerEntry | OtherEntry

export interface ChatResponse {
  answer: string
  trace_file: string
  trace: TraceEntry[]
}

export interface Claims {
  sub: string
  store_id: string
  aud: string
  iat: number
  exp: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

async function detailOf(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const detail: unknown = JSON.parse(text).detail
    // FastAPI's validation errors are a list of objects, everything else a string.
    return typeof detail === 'string' ? detail : JSON.stringify(detail)
  } catch {
    return text || response.statusText
  }
}

export async function fetchToken(persona: Persona): Promise<string> {
  const response = await fetch(`/storefront/token?customer=${encodeURIComponent(persona.customerId)}`)
  if (!response.ok) throw new ApiError(response.status, await detailOf(response))
  return (await response.json()).token
}

/** Reads the token's claims for display. Not verification: that's the backend's job. */
export function decodeClaims(token: string): Claims {
  const payload = token.split('.')[1] ?? ''
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export async function chat(
  token: string,
  message: string,
  allowedTools: string[] | null,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // Only the message and the allowlist: who is asking travels in the token.
    body: JSON.stringify(allowedTools ? { message, allowed_tools: allowedTools } : { message }),
    signal,
  })
  if (!response.ok) throw new ApiError(response.status, await detailOf(response))
  return response.json()
}

export async function isBackendUp(): Promise<boolean> {
  try {
    return (await fetch('/api/health')).ok
  } catch {
    return false
  }
}
