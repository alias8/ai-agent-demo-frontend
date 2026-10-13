import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import type { Run } from '../App.tsx'
import { formatMs, toolCallSteps } from '../trace.ts'
import { ToolCall } from './ToolCall.tsx'

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(timer)
  }, [])
  return <>{((now - since) / 1000).toFixed(1)} s</>
}

const ERROR_HINTS: Record<number, string> = {
  401: 'The backend rejected the token. Its JWT_SECRET must match the one the dev storefront signs with.',
  422: 'The backend rejected the request body.',
  500: 'The run itself failed (a model API error, most likely). The backend log and trace file have the detail.',
  502: 'The dev server could not reach the backend.',
}

export function RunCard({ run }: { run: Run }) {
  const trace = run.response?.trace ?? []
  const steps = toolCallSteps(trace)
  const attempts = steps.reduce((sum, step) => sum + step.attempts.length, 0)
  const toolMs = steps.reduce((sum, step) => sum + step.totalMs, 0)
  const stopped = trace.find((entry) => entry.type === 'max_iterations')

  return (
    <article className="run">
      <header className="run-request">
        <div className="run-meta">
          <code>POST /chat</code>
          <span className="chip">
            {run.persona.customerId} @ {run.persona.storeId}
          </span>
          {run.allowedTools && (
            <span className="chip chip-warn">
              allowed_tools: {run.allowedTools.length ? run.allowedTools.join(', ') : 'none'}
            </span>
          )}
        </div>
        <p className="user-message">{run.message}</p>
      </header>

      <ol className="timeline">
        {run.status === 'pending' && (
          <li className="step step-pending">
            <span className="marker spinner" />
            <div>
              Agent running… <Elapsed since={run.startedAt} />
              <p className="muted small">
                No streaming yet: the backend replies once, when the whole loop has finished.
              </p>
            </div>
          </li>
        )}

        {steps.map((step) => (
          <ToolCall key={step.id} step={step} />
        ))}

        {run.status === 'done' && steps.length === 0 && (
          <li className="step">
            <span className="marker marker-idle" />
            <div className="muted">Answered without calling a tool.</div>
          </li>
        )}

        {stopped && (
          <li className="step">
            <span className="marker marker-fail" />
            <div>Stopped: the loop hit its recursion limit without a final answer.</div>
          </li>
        )}

        {run.response && (
          <li className="step step-answer">
            <span className="marker marker-answer" />
            <div>
              <div className="step-title">Final answer</div>
              <div className="answer">
                <Markdown>{run.response.answer}</Markdown>
              </div>
            </div>
          </li>
        )}

        {run.error && (
          <li className="step">
            <span className="marker marker-fail" />
            <div>
              <div className="step-title">
                Request failed{run.error.status !== null && <> with HTTP {run.error.status}</>}
              </div>
              <pre className="output">{run.error.detail}</pre>
              {run.error.status !== null && ERROR_HINTS[run.error.status] && (
                <p className="muted small">{ERROR_HINTS[run.error.status]}</p>
              )}
            </div>
          </li>
        )}
      </ol>

      {run.response && run.elapsedMs !== undefined && (
        <footer className="run-footer">
          <span>
            <strong>{formatMs(run.elapsedMs)}</strong> total
          </span>
          <span>
            <strong>{steps.length}</strong> tool {steps.length === 1 ? 'call' : 'calls'}
          </span>
          {attempts > steps.length && (
            <span className="warn">
              <strong>{attempts - steps.length}</strong> {attempts - steps.length === 1 ? 'retry' : 'retries'}
            </span>
          )}
          <span title="Everything outside the tools: model calls, retry backoff, network.">
            <strong>{formatMs(toolMs)}</strong> in tools, <strong>{formatMs(Math.max(run.elapsedMs - toolMs, 0))}</strong>{' '}
            elsewhere
          </span>
          <details className="raw">
            <summary>Raw trace</summary>
            <p className="muted small">
              Also appended to <code>{run.response.trace_file}</code> on the backend.
            </p>
            <pre className="output">{JSON.stringify(trace, null, 2)}</pre>
          </details>
        </footer>
      )}
    </article>
  )
}
