import type { Claims } from '../api.ts'
import { PERSONAS, TOOL_SCOPES } from '../personas.ts'
import type { Persona } from '../personas.ts'

interface Props {
  persona: Persona
  onPersonaChange: (persona: Persona) => void
  claims: Claims | null
  tokenError: string | null
  backendUp: boolean | null
  /** True while a run is in flight. */
  locked: boolean
}

const TOOL_NOTES: Record<string, string> = {
  lookup_order_status: 'Postgres, filtered to the customer. Fails 40% of the time on purpose.',
  search_knowledge_base: "Hybrid vector + keyword search over this store's articles.",
  send_notification: 'Side effect, so retries carry an idempotency key. Fails 30% of the time.',
}

export function Sidebar(props: Props) {
  const { persona, claims, backendUp } = props
  const status = backendUp === null ? 'checking' : backendUp ? 'up' : 'down'

  return (
    <aside className="sidebar">
      <header className="brand">
        <h1>Agent Service Inspector</h1>
        <span className={`health health-${status}`}>
          <span className="dot" />
          {status === 'up' ? 'backend up' : status === 'down' ? 'backend unreachable' : 'checking…'}
        </span>
      </header>
      {backendUp === false && (
        <p className="notice notice-error">
          Nothing is answering on port 8000. Start it with <code>uvicorn agent_service.main:app --reload</code>.
        </p>
      )}

      <section>
        <h2>Signed in as</h2>
        <div className="personas">
          {PERSONAS.map((option) => (
            <button
              key={option.customerId}
              className={`persona ${option === persona ? 'selected' : ''}`}
              onClick={() => props.onPersonaChange(option)}
              disabled={props.locked}
            >
              <strong>{option.label}</strong>
              <span>{option.storeName}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Orders: {persona.orders.length ? persona.orders.join(', ') : 'none'}</p>
      </section>

      <section>
        <h2>Token claims</h2>
        {props.tokenError ? (
          <p className="notice notice-error">{props.tokenError}</p>
        ) : claims ? (
          <dl className="claims">
            <dt>sub</dt>
            <dd>{claims.sub}</dd>
            <dt>store_id</dt>
            <dd>{claims.store_id}</dd>
            <dt>scope</dt>
            <dd>{claims.scope}</dd>
            <dt>aud</dt>
            <dd>{claims.aud}</dd>
            <dt>exp</dt>
            <dd>{new Date(claims.exp * 1000).toLocaleTimeString()}</dd>
          </dl>
        ) : (
          <p className="muted small">Fetching token…</p>
        )}
        <p className="muted small">
          The customer, store and scopes reach the agent only through this JWT. Nothing typed in the message can change them.
        </p>
      </section>

      <section>
        <h2>Tools this token grants</h2>
        {Object.entries(TOOL_SCOPES).map(([tool, scope]) => {
          const granted = claims?.scope.split(' ').includes(scope) ?? false
          return (
            <div key={tool} className={`tool-grant ${granted ? '' : 'denied'}`}>
              <span className="grant-mark">{granted ? '✓' : '✕'}</span>
              <span>
                <code>{tool}</code>
                <span className="muted small">
                  needs <code>{scope}</code>. {TOOL_NOTES[tool]}
                </span>
              </span>
            </div>
          )
        })}
        <p className="muted small">
          The backend gives the agent only the tools the token's scopes grant, so the model never sees the others'
          schemas. The browser can't change this: the scopes are signed into the token.
        </p>
      </section>
    </aside>
  )
}
