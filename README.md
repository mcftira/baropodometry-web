# Baropodometry Analyzer

A web application that processes PDF reports from baropodometric (foot pressure) tests, extracts clinical metrics, and generates interpretations using OpenAI's Assistant API.

## What it does

- Uploads baropodometry PDF reports (neutral stance, closed eyes, cotton rolls)
- Extracts structured metrics via a 3-stage OpenAI assistant pipeline
- Compares baseline vs. intervention (with/without device) states
- Produces clinical interpretation text for practitioners

## Stack

- **Next.js + TypeScript** — web frontend and API routes
- **OpenAI Assistant API** (`gpt-4o-mini`, `code_interpreter`, `file_search`) — extraction and analysis
- **Netlify / Vercel** — deployment (see `netlify.toml`, `vercel.json`)

## Getting started

```bash
npm install
cp env.example .env.local   # fill in your OpenAI credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

- `SETUP.md` — environment setup
- `SETUP_LOCAL_DEPLOYMENT.md` — local production deployment
- `SYSTEM_WORKFLOW.md` — analysis pipeline and assistant architecture

## License

MIT — see `LICENSE`.
