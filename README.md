<p align="center">
  <h1 align="center">Praxo</h1>
  <p align="center">
    <strong>Open-source, self-hostable AI mock interview platform.</strong>
  </p>
  <p align="center">
    Practice interviews with AI. Get honest feedback. Improve deliberately.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a> •
  <a href="docs/SELF_HOSTING.md">Self-Hosting</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What is Praxo?

Praxo is a **BYOK (Bring Your Own Key)** AI interview coach that conducts live voice interviews, evaluates your answers in real time, and delivers detailed post-session reports. It is **not** a cheating tool — it is a **deliberate practice platform** for job seekers who want to improve privately.

### Why Praxo?

Every existing interview prep tool is either:
- **Cloud-only** — your mock answers are stored on someone else's server
- **Text-only** — no voice, no real interview pressure
- **Shallow** — no scoring, no follow-ups, no structured feedback
- **Missing pieces** — no code execution, no resume-aware questions, no progress tracking

Praxo combines **voice pipeline + live scoring + coding sandbox + multi-dimensional reports**, all self-hostable, all BYOK, data stays on your machine.

### Key Principles

- **BYOK** — Bring your own LLM key: OpenAI, Claude, Gemini, Groq, OpenRouter, or Ollama (fully local)
- **Self-hostable** — `docker compose up` and you're running. Or `npm start` for lite mode (no Docker)
- **Privacy-first** — Your mock answers, scores, and recordings can stay 100% local
- **Honest feedback** — Multi-dimensional scoring, ideal answers shown, specific improvement tips
- **Extensible** — Add new round types, LLM providers, or voice engines via clean interfaces

---

## Quick Start

### Option A: Lite Mode (No Docker)

Requirements: Node.js 20+, npm

```bash
git clone https://github.com/praxo/praxo.git
cd praxo
cp .env.example .env
# Edit .env — add at least one LLM provider key
npm install
npm run db:setup    # Creates local SQLite database
npm run dev         # Starts on http://localhost:3000
```

### Option B: Full Mode (Docker)

Requirements: Docker, Docker Compose

```bash
git clone https://github.com/praxo/praxo.git
cd praxo
cp .env.example .env
# Edit .env — add at least one LLM provider key
docker compose up
# App:     http://localhost:3000
# Judge0:  http://localhost:2358 (code execution)
```

### Option C: One-Line Install (Coming Soon)

```bash
# Linux/macOS
curl -fsSL https://get.praxo.dev | bash

# Windows (PowerShell)
irm https://get.praxo.dev/install.ps1 | iex
```

---

## Features

### Phase 1 — Core Product

| Feature | Description |
|---|---|
| 🎙️ **Live Voice Interviews** | Real-time STT + TTS conversation with an AI interviewer persona |
| 📋 **Session Configuration** | Upload resume, paste JD, set difficulty, choose round type |
| 📊 **Fluency Tracking** | WPM, pause detection, filler word counting, coherence scoring |
| 📝 **Post-Session Reports** | Per-question scoring, ideal answers, improvement tips, company-fit estimate |
| 📈 **Progress Tracker** | Score history, trend graphs, improvement analytics across sessions |

### Phase 2 — Extended Rounds

| Feature | Description |
|---|---|
| 💻 **Code Editor** | In-browser code editing for DSA round warm-up |
| ▶️ **Code Execution** | Run code with I/O via Judge0 (sandboxed, self-hosted) |
| 🎨 **Whiteboard** | Excalidraw-style whiteboard for system design rounds |

### Round Types

1. **Technical — Resume-based** — Questions pulled from your resume + JD gap analysis
2. **DSA** — Live coding with AI evaluation of logic and complexity
3. **Behavioural** — STAR method evaluation
4. **OOP / CS Fundamentals** — Core concepts and design patterns
5. **System Design** — Architecture discussions with whiteboard

### Supported Providers

| Service | Options |
|---|---|
| **LLM** | OpenAI, Anthropic (Claude), Google (Gemini), Groq, OpenRouter, Ollama (local) |
| **STT** | Deepgram (primary), Whisper (local fallback) |
| **TTS** | OpenAI TTS, Kokoro (local) |
| **Code Execution** | Judge0 (self-hosted Docker) |

---

## Deployment Modes

| Mode | Database | Code Execution | Requirements | Best For |
|---|---|---|---|---|
| **Lite** | SQLite | ❌ Disabled | Node.js 20+ | Quick start, trying it out |
| **Full** | PostgreSQL | ✅ Judge0 | Docker | Full experience, self-hosting |

Both modes share the same codebase. Prisma handles the database abstraction. Switch between modes by changing `DATABASE_URL` in `.env`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), React Server Components |
| UI | shadcn/ui + Tailwind CSS + Lucide icons |
| Voice (STT) | Deepgram (BYOK) / Whisper (local) |
| Voice (TTS) | OpenAI TTS (BYOK) / Kokoro (local) |
| LLM | OpenAI / Anthropic / Gemini / Groq / OpenRouter / Ollama |
| Database | PostgreSQL (full) / SQLite (lite) via Prisma |
| Code Execution | Judge0 (self-hosted) |
| Containerization | Docker + Docker Compose |

---

## Documentation

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Product requirements, user journeys, success metrics |
| [Architecture](docs/ARCHITECTURE.md) | System diagram, data flows, service boundaries |
| [Data Models](docs/DATA_MODELS.md) | Full Prisma schema, table relationships |
| [API Spec](docs/API_SPEC.md) | Every endpoint, request/response shapes |
| [Voice Pipeline](docs/VOICE_PIPELINE.md) | STT/TTS design, state machine, edge cases |
| [Scoring Engine](docs/SCORING_ENGINE.md) | Scoring prompts, dimension weights, output format |
| [LLM Abstraction](docs/LLM_ABSTRACTION.md) | Provider interface, adapter pattern, streaming |
| [Round Types](docs/ROUND_TYPES.md) | Per-round flow, prompt strategy, scoring weights |
| [Personalization](docs/PERSONALIZATION.md) | Resume/JD parsing, gap analysis |
| [Self-Hosting](docs/SELF_HOSTING.md) | Docker setup, env vars, first-run guide |
| [Design System](docs/DESIGN_SYSTEM.md) | Tokens, component conventions, Pencil-first workflow |
| [Phase Plan](docs/PHASE_PLAN.md) | Build sequence, dependencies, complexity estimates |
| [Engineering Rules](docs/ENGINEERING_RULES.md) | Coding standards, patterns, checklists |

---

## Screenshots

> Screenshots will be added after Pencil wireframes are finalized and Phase 1 UI is implemented.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit standards, and contribution guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built for honest practice. Not for cheating.</sub>
</p>
