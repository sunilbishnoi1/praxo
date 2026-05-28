<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--beta-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node" />
  <img src="https://img.shields.io/badge/next.js-16+-000.svg" alt="Next.js" />
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
  <a href="#key-features"><strong>Key Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#security--self-hosting"><strong>Security</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a>
</p>

---

## What is Praxo?

Praxo is a **BYOK (Bring Your Own Key)** AI interview coach that conducts live voice interviews, evaluates your answers in real time, and delivers detailed post-session reports. It is **not** a cheating tool — it is a **deliberate practice platform** for job seekers who want to improve privately, securely, and cost-effectively.

---

## Key Features

* **⚡ Dual Voice Pipelines**:
  * **Real-Time Mode**: Bidirectional, low-latency voice streaming using Gemini Live (`gemini-3.1-flash-live-preview`) or OpenAI Realtime (`gpt-4o-realtime-preview`) APIs.
  * **Cascaded Mode**: Standard chaining with customizable Speech-to-Text (STT) and Text-to-Speech (TTS) engines, compatible with all standard models.
* **🔑 BYOK Architecture**: Use your own API keys for pay-as-you-go pricing (or run fully local models). No subscriptions, no lock-in.
* **📊 Fluency & Coherence Tracking**: Real-time tracking of words-per-minute (WPM), speech pause detection, filler word counting, and speech coherence scoring.
* **📝 Detailed Post-Session Reports**: Get multi-dimensional grades per question, ideal answer templates, personalized technical roadmap focus areas, and role-fit evaluation.
* **🛠️ Versatile Round Types**: Support for Technical (Resume & JD based), Behavioral (STAR method evaluation), DSA (with in-browser code editor & runner), OOP/CS Fundamentals, and System Design (with integrated whiteboard).

---

## Quick Start

### 1. Setup Environment
Clone the repository and prepare your environment variables:
```bash
git clone https://github.com/praxo/praxo.git
cd praxo
cp .env.example .env
# Edit .env and configure your LLM provider keys and credentials
```

> [!NOTE]
> Praxo requires an `ENCRYPTION_KEY` in `.env` to secure credentials in the local database. You can generate one with:
> `openssl rand -hex 32`

### 2. Choose Your Deployment Mode

#### Option A: Lite Mode (SQLite)
Perfect for trying out the core mock interview experience quickly without Docker.
* **Requirements**: Node.js 20+, npm
```bash
npm install
npm run db:setup
npm run dev
# Open http://localhost:3000
```

#### Option B: Full Mode (Docker Compose)
Enables full PostgreSQL support and Judge0 sandboxed code execution for technical coding/DSA rounds.
* **Requirements**: Docker, Docker Compose
```bash
docker compose up
# App:     http://localhost:3000
# Judge0:  http://localhost:2358 (Sandboxed code runner)
```

---

## Tech Stack & Ecosystem

| Layer | Technologies |
|---|---|
| **Core Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling & UI** | Tailwind CSS v4, shadcn/ui, Lucide React |
| **Database** | SQLite (Lite mode) / PostgreSQL (Full mode) via Prisma |
| **LLM Providers** | Google Gemini, OpenAI, Anthropic (Claude), Groq, OpenRouter, Ollama |
| **Speech Processing** | Deepgram & local Whisper (STT) \| OpenAI & local Kokoro (TTS) |
| **Code Execution** | Judge0 (Self-hosted sandboxed runtime) |

---

## Security & Self-Hosting

Praxo is single-user by design and keeps your data private.
- **Credential Storage**: BYOK keys entered in the UI are securely encrypted using AES-256-GCM in your local database.
- **LAN Protection**: If you expose your Praxo instance beyond `localhost`, you can define a `PRAXO_ACCESS_PIN` in your `.env` to prevent unauthorized access.
- **Local Fallbacks**: Support for Ollama, local Whisper, and Kokoro allows fully offline local execution for maximum privacy.

---

## Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for development setups, commit standards, and our feature branch guidelines.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
