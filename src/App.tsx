import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, chat, decodeClaims, fetchToken, isBackendUp } from './api.ts'
import type { ChatResponse } from './api.ts'
import { Composer } from './components/Composer.tsx'
import { RunCard } from './components/RunCard.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { PERSONAS } from './personas.ts'
import type { Persona } from './personas.ts'

export interface Run {
  id: number
  message: string
  persona: Persona
  startedAt: number
  status: 'pending' | 'done' | 'error'
  elapsedMs?: number
  response?: ChatResponse
  error?: { status: number | null; detail: string }
}

const TOKEN_REFRESH_MARGIN_S = 60

function isFresh(token: string): boolean {
  return decodeClaims(token).exp - Date.now() / 1000 > TOKEN_REFRESH_MARGIN_S
}

export function App() {
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]!)
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [backendUp, setBackendUp] = useState<boolean | null>(null)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)

  // "Log in" as the selected customer: ask the storefront for their token.
  useEffect(() => {
    let cancelled = false
    setToken(null)
    setTokenError(null)
    fetchToken(persona)
      .then((fresh) => !cancelled && setToken(fresh))
      .catch((error: Error) => !cancelled && setTokenError(error.message))
    return () => {
      cancelled = true
    }
  }, [persona])

  useEffect(() => {
    const check = () => void isBackendUp().then(setBackendUp)
    check()
    const timer = setInterval(check, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [runs])

  const pending = runs.some((run) => run.status === 'pending')

  const send = useCallback(
    async (message: string) => {
      const id = nextId.current++
      const startedAt = performance.now()
      setRuns((all) => [...all, { id, message, persona, startedAt, status: 'pending' }])
      const finish = (result: Partial<Run>) =>
        setRuns((all) =>
          all.map((run) => (run.id === id ? { ...run, ...result, elapsedMs: performance.now() - startedAt } : run)),
        )
      try {
        let current = token
        if (!current || !isFresh(current)) {
          current = await fetchToken(persona)
          setToken(current)
        }
        finish({ status: 'done', response: await chat(current, message) })
      } catch (error) {
        finish({
          status: 'error',
          error: {
            status: error instanceof ApiError ? error.status : null,
            detail: error instanceof Error ? error.message : String(error),
          },
        })
      }
    },
    [persona, token],
  )

  return (
    <div className="layout">
      <Sidebar
        persona={persona}
        onPersonaChange={setPersona}
        claims={token ? decodeClaims(token) : null}
        tokenError={tokenError}
        backendUp={backendUp}
        locked={pending}
      />
      <main className="main">
        <div className="runs">
          {runs.length === 0 && (
            <div className="empty">
              <h2>Ask the agent something</h2>
              <p>
                Each message is one <code>POST /chat</code>. The reply comes back with the trace of that run, so every
                tool call, retry and result is laid out below the question.
              </p>
              <p className="muted">
                Runs are independent: the backend keeps no conversation history, so the agent doesn't remember the
                previous message.
              </p>
            </div>
          )}
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
          <div ref={bottom} />
        </div>
        <Composer persona={persona} disabled={pending} onSend={send} />
      </main>
    </div>
  )
}
