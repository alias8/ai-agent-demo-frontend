import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { examplesFor } from '../personas.ts'
import type { Persona } from '../personas.ts'

interface Props {
  persona: Persona
  disabled: boolean
  onSend: (message: string) => void
}

export function Composer({ persona, disabled, onSend }: Props) {
  const [draft, setDraft] = useState('')

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || disabled) return
    onSend(message)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="examples">
        {examplesFor(persona).map((example) => (
          <button key={example.label} type="button" title={example.message} onClick={() => setDraft(example.message)}>
            {example.label}
          </button>
        ))}
      </div>
      <div className="composer-row">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message the agent as ${persona.customerId}…`}
          rows={2}
          autoFocus
        />
        <button type="submit" className="send" disabled={disabled || !draft.trim()}>
          {disabled ? 'Running…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
