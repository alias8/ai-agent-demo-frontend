// Stands in for the storefront during local development.
//
// The agent service doesn't log customers in: a storefront does, and hands
// the browser a short-lived JWT signed with a secret the two share. There is
// no storefront here, so the Vite dev server plays that part — the secret
// stays in Node and never reaches the browser bundle.
//
// The secret is JWT_SECRET from this project's .env, or else from the
// backend's own .env next door, so there is nothing to copy across.

import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { PERSONAS } from './src/personas.ts'

const AUDIENCE = 'agent-service' // the backend's default jwt_audience
const TTL_SECONDS = 30 * 60
const BACKEND_ENV = resolve(import.meta.dirname, '../ai-agent-demo-python/.env')

function readSecret(mode: string): string | undefined {
  const own = loadEnv(mode, import.meta.dirname, '').JWT_SECRET
  if (own) return own
  if (!existsSync(BACKEND_ENV)) return undefined
  const line = readFileSync(BACKEND_ENV, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('JWT_SECRET='))
  return line?.trim().slice('JWT_SECRET='.length).replace(/^(['"])(.*)\1$/, '$2') || undefined
}

function mintToken(secret: string, customerId: string, storeId: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: customerId, store_id: storeId, aud: AUDIENCE, iat: now, exp: now + TTL_SECONDS }
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

export function devStorefront(): Plugin {
  let secret: string | undefined

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: object) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    const customerId = new URL(req.url ?? '', 'http://localhost').searchParams.get('customer')
    const persona = PERSONAS.find((p) => p.customerId === customerId)
    if (!persona) return send(404, { detail: `unknown customer: ${customerId}` })
    if (!secret) {
      return send(500, {
        detail: `No JWT_SECRET found. Set it in this project's .env, or in ${BACKEND_ENV}.`,
      })
    }
    send(200, { token: mintToken(secret, persona.customerId, persona.storeId) })
  }

  return {
    name: 'dev-storefront',
    config(_, { mode }) {
      secret = readSecret(mode)
    },
    configureServer(server) {
      server.middlewares.use('/storefront/token', handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/storefront/token', handle)
    },
  }
}
