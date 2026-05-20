<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--beta-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node" />
  <img src="https://img.shields.io/badge/next.js-14+-000.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/typescript-5+-3178C6.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/prisma-5+-2D3748.svg" alt="Prisma" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED.svg" alt="Docker" />
</p>

<h1 align="center">Praxo</h1>

<p align="center">
  <strong>Open-source, self-hostable AI mock interview platform.</strong>
</p>

<p align="center">
  Practice interviews with AI. Get honest feedback. Improve deliberately.
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#deployment-modes"><strong>Deployment</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a>
</p>

---

## What is Praxo?

Praxo is a **BYOK (Bring Your Own Key)** AI interview coach that conducts live voice interviews, evaluates your answers in real time, and delivers detailed post-session reports. It is **not** a cheating tool — it is a **deliberate practice platform** for job seekers who want to improve privately.

### Key Principles

- **BYOK** — Bring your own LLM key: OpenAI, Claude, Gemini, Groq, OpenRouter, or Ollama (fully local)
- **Self-hostable** — `docker compose up` and you're running. Or `npm start` for lite mode (no Docker)
- **Privacy-first** — Your mock answers, scores, and recordings can stay 100% local
- **Honest feedback** — Multi-dimensional scoring, ideal answers shown, specific improvement tips
- **Extensible** — Add new round types, LLM providers, or voice engines via clean interfaces

---

## Quick Start

### Option A: Lite Mode (No Docker)

**Requirements:** Node.js 20+, npm

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

**Requirements:** Docker, Docker Compose

```bash
git clone https://github.com/praxo/praxo.git
cd praxo
cp .env.example .env
# Edit .env — add at least one LLM provider key
docker compose up
# App:     http://localhost:3000
# Judge0:  http://localhost:2358 (code execution)
```

### Option C: One-Line Install *(Coming Soon)*

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
| Live Voice Interviews | Real-time STT + TTS conversation with an AI interviewer persona |
| Session Configuration | Upload resume, paste JD, set difficulty, choose round type |
| Fluency Tracking | WPM, pause detection, filler word counting, coherence scoring |
| Post-Session Reports | Per-question scoring, ideal answers, improvement tips, company-fit estimate |
| Progress Tracker | Score history, trend graphs, improvement analytics across sessions |

### Phase 2 — Extended Rounds

| Feature | Description |
|---|---|
| Code Editor | In-browser code editing for DSA round warm-up |
| Code Execution | Run code with I/O via Judge0 (sandboxed, self-hosted) |
| Whiteboard | Excalidraw-style whiteboard for system design rounds |

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
| **Lite** | SQLite | Disabled | Node.js 20+ | Quick start, trying it out |
| **Full** | PostgreSQL | Judge0 | Docker | Full experience, self-hosting |

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

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit standards, and contribution guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built for honest practice. Not for cheating.</sub>
</p>
