# ai-agent-demo-frontend

A React UI for the Python agent backend at https://github.com/alias8/python_ai_agent that shows what the agent did to answer each message: which tools it called, with what arguments, every retry attempt, what each tool returned, and where the time went.

## Run it

Start the backend first (see its README for the one-time database setup). The commands below assume it is cloned next to this repo as `ai-agent-demo-python`:

```
cd ../ai-agent-demo-python
docker compose up -d
source .venv/bin/activate
uvicorn agent_service.main:app --reload
```

Then, here:

```
npm install
npm run dev
```

and open the URL Vite prints. The backend's `.env` needs a working `ANTHROPIC_API_KEY`; without one every message fails with an HTTP 500.

## How it talks to the backend

The browser only talks to the Vite dev server.

- **`/api/*`** is proxied to the backend on `localhost:8000` (set `AGENT_SERVICE_URL` to point elsewhere), so the backend needs no CORS setup.
- **`/storefront/token`** is answered by `dev-storefront.ts`, a Vite plugin that stands in for the storefront. The backend doesn't log customers in. It verifies a JWT the storefront signs with a shared secret. The plugin signs one for the customer picked in the sidebar, including the scopes that decide which tools the agent gets, using `JWT_SECRET` from this project's `.env` or, if there isn't one, from `../ai-agent-demo-python/.env`. The secret stays in Node and never reaches the browser.

Because of that plugin this is a development tool: `npm run build` produces a static bundle with nobody to mint its tokens.

`POST /chat` returns the answer and the run's trace entries, one per tool-call attempt. `src/trace.ts` groups attempts by `tool_call_id` back into the calls the model made. There is no streaming, so a run appears all at once when the loop finishes, and no conversation history, so each message is an independent run.

## Things to try

The chips above the message box fill in a prompt for each of these.

- **Someone else's order**: the reply is the same "not found" as for an order that doesn't exist.
- **Store policy**: ask as `cust-1001`, then as `cust-3003`. The two stores' return policies differ, and search only sees the signed-in store's articles.
- **Chained tools**: an order lookup followed by a notification. The order service fails 40% of the time on purpose, so retries show up often.
- **Prompt injection**: claiming to be another customer changes nothing, because identity comes from the token.
- **Guest**: the guest token carries only the `kb:read` scope, so the agent gets only knowledge-base search. Ask it about an order and it has no tool to look one up.

## Layout

```
dev-storefront.ts        Vite plugin that mints customer JWTs
src/
  api.ts                 fetch calls and the response types
  trace.ts               groups trace entries into tool calls
  personas.ts            the seeded customers, their stores and scopes, example prompts
  App.tsx                state: who is signed in, their token, the list of runs
  components/
    Sidebar.tsx          identity, token claims, the tools the token grants, backend health
    RunCard.tsx          one request: the timeline, final answer and timings
    ToolCall.tsx         one tool call: arguments, attempts, result
    Composer.tsx         message box and example prompts
```
