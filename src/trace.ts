import type { ToolCallEntry, TraceEntry } from './api.ts'

export type Outcome =
  | 'succeeded' // returned a result (possibly after retries)
  | 'error_result' // ran fine, but the result itself is an error ("no order found")
  | 'gave_up' // every attempt raised a transient error
  | 'failed' // raised something that isn't retried

/** One tool call as the model made it, with every attempt the backend took at it. */
export interface ToolCallStep {
  id: string
  tool: string
  input: Record<string, unknown>
  attempts: ToolCallEntry[]
  outcome: Outcome
  /** The tool's result, when an attempt returned one. */
  output: string | null
  totalMs: number
}

function outcomeOf(last: ToolCallEntry): Outcome {
  if (last.success) return 'succeeded'
  if (last.output !== null) return 'error_result'
  return last.error_type === 'TransientToolError' ? 'gave_up' : 'failed'
}

/**
 * The backend traces one entry per attempt. Attempts at the same call share a
 * tool_call_id, so grouping on it turns the flat trace back into the calls the
 * model actually made, in the order they first ran.
 */
export function toolCallSteps(trace: TraceEntry[]): ToolCallStep[] {
  const groups = new Map<string, ToolCallEntry[]>()
  for (const entry of trace) {
    if (entry.type !== 'tool_call') continue
    const call = entry as ToolCallEntry
    const id = call.tool_call_id ?? `iteration-${call.iteration}`
    groups.set(id, [...(groups.get(id) ?? []), call])
  }
  return [...groups].map(([id, attempts]) => {
    const last = attempts[attempts.length - 1]!
    return {
      id,
      tool: last.tool,
      input: last.input,
      attempts,
      outcome: outcomeOf(last),
      output: last.output,
      totalMs: attempts.reduce((sum, attempt) => sum + attempt.duration_ms, 0),
    }
  })
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}
