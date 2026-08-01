# Aur Kuch? — a Blinkit clone with an AI household-graph feature

A pixel-faithful clone of the Blinkit web storefront with one AI feature embedded in it:
during "Being packed" on the order-tracking screen, the app infers unstated household
facts (infant in the house, a dog, an active fitness routine, ...) from a persona's real
order history via an LLM, and surfaces at most one contextual suggestion per order.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4** — frontend + server actions/API
- **Postgres** via **Prisma 7** (driver adapter `@prisma/adapter-pg`) — catalog, sessions,
  orders, household graph, instrumentation events
- **Groq** (Llama 3.3 70B, OpenAI-compatible API) — the abductive household-graph inference
- No auth: anonymous per-visitor sessions via an httpOnly cookie set in middleware

## Project structure

- `src/app/(shop)/*` — the consumer storefront (home, category, search, cart, order
  tracking/history), wrapped in a shared layout with the Blinkit header/footer/cart/demo
  panel
- `src/app/internal/*` — the instrumentation dashboard, deliberately outside the shop
  layout group so it never inherits consumer chrome
- `src/lib/graph/*` — the Groq call, prompt, and Zod-validated response schema
- `src/lib/attributes.ts` — the 10 household attributes, their leak category, and ASK copy
- `src/lib/leakLedger.ts` — the auditable ₹ leak-value lookup (real catalog price × a
  documented monthly-frequency constant, never a model-generated number)
- `src/lib/suggestion.ts` — guardrails: hard cap of one suggestion/order, category-already-
  purchased exclusion, 30-day suppression after two declines
- `src/data/seed.ts` — the ~384-SKU catalog and the four personas' engineered order
  histories (Priya/Rohit/Ananya/Vikram)

## Local development

```bash
npm install
npx prisma dev            # spins up a local Postgres-compatible dev server
cp .env.example .env       # fill in DATABASE_URL (from the command above) and GROQ_API_KEY
npm run db:push            # apply the schema
npm run db:seed            # load the product catalog
npm run dev
```

## Environment variables

| Variable         | Purpose                                              |
| ----------------- | ----------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection string                            |
| `GROQ_API_KEY`     | Groq API key for the household-graph inference calls  |

## Deploying

1. Import this repo in the [Vercel dashboard](https://vercel.com/new) (auto-detects
   Next.js, zero config).
2. In the project's **Storage** tab, create a Postgres database — this wires
   `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `GROQ_API_KEY`.
4. Deploy. Every subsequent push to this branch redeploys automatically via Vercel's
   native GitHub integration.

## Demo

- A corner gear icon opens the demo control panel: switch persona, fast-forward the
  active order's status, advance the simulated day counter (for suppression windows),
  and reset a persona's state.
- Deep-link directly to a persona's state with `?persona=priya` (`priya` / `rohit` /
  `ananya` / `vikram` / `guest`).
- `?persona=guest` (or the "Guest" button in the demo panel) starts from a blank slate —
  no seeded order history — so a real stranger's Aur Kuch? suggestions are inferred only
  from orders they actually place, instead of Priya's pre-built history.
- `/internal` is the instrumentation dashboard (household graph, funnel, suppression log,
  leak ledger) — not linked from consumer navigation.
