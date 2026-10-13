import { formatMs } from '../trace.ts'
import type { Outcome, ToolCallStep } from '../trace.ts'

const OUTCOME: Record<Outcome, { label: string; tone: 'ok' | 'warn' | 'fail' }> = {
  succeeded: { label: 'succeeded', tone: 'ok' },
  error_result: { label: 'returned an error', tone: 'warn' },
  gave_up: { label: 'gave up', tone: 'fail' },
  failed: { label: 'failed', tone: 'fail' },
}

// What the agent's middleware does with a call that never returned a result.
const NO_RESULT_NOTE: Partial<Record<Outcome, string>> = {
  gave_up:
    'Every attempt hit a transient error, so the retry middleware stopped and told the model the service is temporarily unavailable.',
  failed:
    "Not a transient error, so it wasn't retried. The model was told only the exception's type; the message stays in the backend's trace file.",
}

const KB_SEPARATOR = '\n\n---\n\n'

/** search_knowledge_base returns its chunks as "# Article > Section\n\ntext", joined by rules. */
function KnowledgeBaseChunks({ output }: { output: string }) {
  const chunks = output.split(KB_SEPARATOR).map((chunk) => {
    const [heading = '', ...body] = chunk.split('\n\n')
    return { heading: heading.replace(/^# /, ''), text: body.join('\n\n') }
  })
  return (
    <div className="chunks">
      <p className="muted small">
        {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'} passed the relevance cutoff
      </p>
      {chunks.map((chunk, index) => (
        <details key={index} className="chunk">
          <summary>{chunk.heading}</summary>
          <p>{chunk.text}</p>
        </details>
      ))}
    </div>
  )
}

function Result({ step }: { step: ToolCallStep }) {
  if (step.output === null) return <p className="muted small">{NO_RESULT_NOTE[step.outcome]}</p>
  if (step.tool === 'search_knowledge_base' && step.output.startsWith('# ')) {
    return <KnowledgeBaseChunks output={step.output} />
  }
  return <pre className="output">{step.output}</pre>
}

export function ToolCall({ step }: { step: ToolCallStep }) {
  const outcome = OUTCOME[step.outcome]
  const retried = step.attempts.length > 1

  return (
    <li className="step">
      <span className={`marker marker-${outcome.tone}`} />
      <div>
        <div className="step-title">
          <code className="tool-name">{step.tool}</code>
          <span className={`badge badge-${outcome.tone}`}>
            {outcome.label}
            {retried && ` after ${step.attempts.length} attempts`}
          </span>
          <span className="muted small">{formatMs(step.totalMs)}</span>
        </div>

        <div className="args">
          {Object.entries(step.input).map(([name, value]) => (
            <span key={name} className="arg">
              <span className="muted">{name}</span> {JSON.stringify(value)}
            </span>
          ))}
        </div>

        {(retried || step.output === null) && (
          <ol className="attempts">
            {step.attempts.map((attempt, index) => (
              <li key={attempt.timestamp + index} className={attempt.output === null ? 'attempt-failed' : ''}>
                <span>attempt {index + 1}</span>
                <span>{attempt.output === null ? (attempt.error_type ?? 'raised') : 'returned'}</span>
                <span className="muted">{formatMs(attempt.duration_ms)}</span>
              </li>
            ))}
          </ol>
        )}

        <Result step={step} />
      </div>
    </li>
  )
}
