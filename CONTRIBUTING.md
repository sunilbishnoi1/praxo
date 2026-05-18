# Contributing to Praxo

Thank you for your interest in contributing to Praxo! This document covers everything you need to get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Git Workflow](#git-workflow)
- [Commit Standards](#commit-standards)
- [Pull Request Process](#pull-request-process)
- [Code Review Checklist](#code-review-checklist)
- [Adding a New Feature](#adding-a-new-feature)
- [Adding a New Round Type](#adding-a-new-round-type)
- [Adding a New LLM Provider](#adding-a-new-llm-provider)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

Be respectful, constructive, and inclusive. We're building a tool to help people get jobs — keep that mission in mind.

---

## Development Setup

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **Docker** + **Docker Compose** (for full mode only)
- **Git**

### Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/praxo.git
cd praxo

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — add at least one LLM provider key

# 4. Set up database (lite mode — SQLite)
npm run db:setup

# 5. Start dev server
npm run dev
```

### Full Mode (with Docker)

```bash
# Start PostgreSQL + Judge0
docker compose -f docker-compose.dev.yml up -d

# Update .env
# DATABASE_URL=postgresql://praxo:praxo@localhost:5432/praxo
# DEPLOYMENT_MODE=full

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```

### Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler check |
| `npm run test` | Run unit + integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:setup` | Create SQLite database + run migrations |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database with sample data |

---

## Project Structure

```
praxo/
├── src/
│   ├── app/                    # Next.js App Router pages + API routes
│   │   ├── (dashboard)/        # Dashboard pages
│   │   ├── session/            # Interview session pages
│   │   ├── reports/            # Report viewing pages
│   │   ├── api/                # API route handlers
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── features/               # Feature modules (core business logic)
│   │   ├── voice/              # Voice pipeline (STT, TTS, VAD)
│   │   ├── scoring/            # Scoring engine
│   │   ├── session/            # Session management
│   │   ├── llm/                # LLM abstraction layer
│   │   ├── personalization/    # Resume/JD parsing, gap analysis
│   │   ├── rounds/             # Round type definitions
│   │   ├── code-execution/     # Judge0 integration
│   │   └── progress/           # Progress tracking
│   ├── components/             # Shared UI components (shadcn/ui based)
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── shared/             # App-specific shared components
│   ├── lib/                    # Shared utilities
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── encryption.ts       # Key encryption/decryption
│   │   ├── validation.ts       # Zod schemas
│   │   └── utils.ts            # General utilities
│   ├── hooks/                  # React hooks
│   └── types/                  # Shared TypeScript types
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration files
├── public/                     # Static assets
├── tests/
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # Playwright E2E tests
├── docs/                       # Documentation
├── docker/                     # Docker-related files
│   ├── Dockerfile              # App Dockerfile
│   └── judge0/                 # Judge0 config
├── docker-compose.yml          # Production compose
├── docker-compose.dev.yml      # Development compose
└── .env.example                # Environment template
```

This is a **feature-based** structure. Each feature module in `src/features/` owns its:
- Business logic
- Types / interfaces
- Server actions (if any)
- API route handlers (referenced from `src/app/api/`)
- Unit tests (co-located or in `tests/`)

---

## Git Workflow

### Branching Strategy

```
main            # Production-ready, always deployable
├── develop     # Integration branch for features
│   ├── feat/voice-pipeline     # Feature branches
│   ├── feat/scoring-engine
│   ├── fix/deepgram-reconnect
│   └── chore/update-deps
```

1. Create a feature branch from `develop`
2. Work on your feature
3. Open a PR into `develop`
4. After review + CI passes, squash-merge
5. `develop` → `main` happens via release PRs

### Branch Naming

```
feat/<short-description>     # New feature
fix/<short-description>      # Bug fix
chore/<short-description>    # Maintenance, deps, config
docs/<short-description>     # Documentation only
refactor/<short-description> # Code refactoring (no behavior change)
test/<short-description>     # Test additions/fixes
```

---

## Commit Standards

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance (deps, config, build) |
| `docs` | Documentation changes |
| `refactor` | Code change that doesn't fix a bug or add a feature |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Scopes

Use the feature module name: `voice`, `scoring`, `session`, `llm`, `rounds`, `personalization`, `code-execution`, `progress`, `ui`, `db`, `api`.

### Examples

```bash
feat(voice): add Deepgram WebSocket reconnection logic
fix(scoring): correct STAR weight calculation for behavioural rounds
chore(deps): update prisma to 6.x
docs(api): add WebSocket endpoint documentation
refactor(llm): extract streaming response handler to shared utility
test(scoring): add unit tests for fluency analyzer
```

### Rules

- **No commented-out code** committed — ever
- **Each commit should compile** — no broken intermediate states
- **Each PR = one feature** — keep changes atomic and reviewable

---

## Pull Request Process

### Before Opening a PR

- [ ] Code compiles with no TypeScript errors (`npm run type-check`)
- [ ] Linter passes (`npm run lint`)
- [ ] All existing tests pass (`npm run test`)
- [ ] New tests written for new logic
- [ ] No `any` types introduced
- [ ] No hardcoded strings (API keys, URLs, etc.)
- [ ] No `console.log` left in production code (use structured logger)
- [ ] Environment variables documented in `.env.example` if new ones added

### PR Template

```markdown
## What

Brief description of the change.

## Why

Context on why this change is needed.

## How

Key implementation decisions and trade-offs.

## Testing

How was this tested? What test cases were added?

## Checklist

- [ ] TypeScript strict — no `any`
- [ ] Zod validation on all external inputs
- [ ] Loading + error states implemented
- [ ] ARIA labels on interactive elements
- [ ] Mobile-responsive
- [ ] Tests added/updated
- [ ] Docs updated if needed
```

---

## Code Review Checklist

Reviewers should verify:

1. **Type safety** — No `any`, no type assertions without justification
2. **Validation** — All external inputs (API requests, form data, env vars) validated with Zod
3. **Error handling** — Async operations have try/catch, errors are user-friendly
4. **Loading states** — Every async UI operation shows loading feedback
5. **No hardcoded values** — Keys, URLs, model names come from env/config
6. **Feature isolation** — No cross-feature imports except through public interfaces
7. **Database** — Access only through Prisma, only in server-side code
8. **Accessibility** — ARIA labels, keyboard navigation, focus management
9. **Security** — No secrets in client code, API keys encrypted at rest
10. **Performance** — No unnecessary re-renders, no N+1 queries

---

## Adding a New Feature

Follow this checklist for every new feature:

1. **Docs first** — Update relevant doc in `docs/` before writing code
2. **Pencil wireframe** — Design the UI in Pencil MCP before implementing
3. **Create feature module** — `src/features/<feature-name>/`
   ```
   src/features/<feature-name>/
   ├── index.ts                 # Public API of this feature
   ├── types.ts                 # Feature-specific types
   ├── <feature>.service.ts     # Business logic
   ├── <feature>.validation.ts  # Zod schemas
   ├── components/              # Feature-specific React components
   └── __tests__/               # Unit tests
   ```
4. **Define types** — Write TypeScript interfaces and Zod schemas first
5. **Build API** — Create API route handlers in `src/app/api/`
6. **Test API** — Write integration tests for the API routes
7. **Build UI** — Implement React components using shadcn/ui
8. **Test E2E** — Write Playwright test for the critical path
9. **Update docs** — API spec, architecture diagram if needed

---

## Adding a New Round Type

1. Create round definition in `src/features/rounds/<round-type>/`
2. Implement the `RoundType` interface:
   ```typescript
   interface RoundType {
     id: string;
     name: string;
     description: string;
     phase: 1 | 2;
     generateQuestions(context: SessionContext): Promise<Question[]>;
     generateFollowUp(answer: Answer, question: Question): Promise<Question | null>;
     getScoringWeights(): ScoringWeights;
     getSystemPrompt(context: SessionContext): string;
   }
   ```
3. Register the round type in `src/features/rounds/registry.ts`
4. Add scoring weights to `docs/ROUND_TYPES.md`
5. Create Pencil wireframe for any round-specific UI
6. Write tests for question generation and scoring

---

## Adding a New LLM Provider

See [LLM_ABSTRACTION.md](docs/LLM_ABSTRACTION.md) for the full guide. Summary:

1. Create adapter in `src/features/llm/adapters/<provider>.adapter.ts`
2. Implement the `LLMProvider` interface
3. Register in `src/features/llm/registry.ts`
4. Add env vars to `.env.example`
5. Add provider to the UI settings dropdown
6. Write integration test with mock responses

---

## Testing

### Unit Tests

- Co-located with source or in `tests/unit/`
- Use Vitest
- Focus on: scoring engine, fluency analyzer, LLM adapters, parsers

```bash
npm run test                    # All unit + integration tests
npm run test -- --watch         # Watch mode
npm run test -- scoring         # Run tests matching "scoring"
```

### Integration Tests

- In `tests/integration/`
- Test API routes with real request/response cycle
- Use test database (SQLite)

### E2E Tests

- In `tests/e2e/`
- Use Playwright
- Critical paths:
  1. Start app → Dashboard
  2. Configure session → Start → Complete → View report
  3. Upload resume → Configure → Session with personalized questions
  4. View progress → Verify trend data

```bash
npm run test:e2e               # Run all E2E tests
npm run test:e2e -- --ui       # Run with Playwright UI
```

---

## Documentation

- Every feature must have API documentation in `docs/API_SPEC.md`
- Architecture changes must update `docs/ARCHITECTURE.md`
- New environment variables must be documented in `.env.example`
- User-facing features should have entries in `README.md`

---

## Questions?

Open a [Discussion](https://github.com/praxo/praxo/discussions) for questions, ideas, or feedback.

Thank you for helping make interview prep accessible and private! 🎙️
