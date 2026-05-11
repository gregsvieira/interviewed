# AI Interviewed Me

---

## English

### Why AI Interviewed Me?

Landing a software engineering role takes preparation. Endless hours of studying, countless behavioral prep, and worst of all — never knowing if you're truly ready.

**AI Interviewed Me** is a AI-driven mock interview simulator that feels real. It asks dynamic technical and behavioral questions, listens to your spoken answers, transcribes them in real time, evaluates your responses, and speaks back — just like a real interviewer.

| Feature | Benefit |
|---------|---------|
| **Voice-first** | Speak your answers naturally. Audio transcribed locally via Whisper. |
| **Adaptive questioning** | AI generates questions on the fly — no static question banks. |
| **Instant evaluation** | Get scored on every answer immediately after your interview. |
| **Real-time TTS** | The interviewer reads questions aloud via browser speech synthesis. |
| **Multiple topics** | Frontend, Backend, FullStack, DevOps, Database, Soft Skills. |
| **All levels** | Entry, Junior, Mid, Pleno, Senior — each with tailored difficulty. |
| **History & stats** | Track streaks, skill radar charts, and improvement areas over time. |
| **100% private** | Everything runs locally via Docker + Ollama. Zero data leaves your machine. |
| **Free & open source** | No API costs. Self-hosted. No vendor lock-in. |

---

### Getting Started

#### Prerequisites

- Docker & Docker Compose (v2+)
- 8GB+ RAM minimum (16GB recommended)
- ~10GB free disk space for Docker images + LLM models

#### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd interviewed

# 2. Configure environment
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Start all services (CPU)
docker compose up -d

# Or with NVIDIA GPU support:
# docker compose -f docker-compose.gpu.yml up -d

# 4. Download the LLM model (wait ~30s for Ollama to start)
docker exec -it interviewed-ollama ollama pull qwen2.5-coder

# 5. Open the app
open http://localhost:8080
```

#### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| Ollama API | http://localhost:11434 |
| STT Service | http://localhost:8001 |

#### Useful Commands

```bash
# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build

# Stop everything
docker compose down

# Full clean (destroys volumes)
docker compose down -v

# Exec into backend shell
docker exec -it interviewed-backend sh

# List Ollama models
docker exec -it interviewed-ollama ollama list

# Test Ollama directly
docker exec -it interviewed-ollama ollama run qwen2.5-coder "Hello"
```

#### Development Without Docker

```bash
# Backend (requires PostgreSQL + Ollama running locally)
cd apps/backend
npm install
npm run start:dev

# Frontend (Vite dev server with proxy to localhost:3000)
cd apps/frontend
npm install
npm run dev

# STT Service (requires Python 3.11 + ffmpeg)
cd apps/stt-service
pip install -r requirements.txt
python app.py
```

---

### Architecture & System Design

#### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCKER NETWORK                               │
│                  (interviewed-network)                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │   FRONTEND   │    │   BACKEND    │    │    OLLAMA       │   │
│  │   React 18   │    │   NestJS 10  │    │ ─────────────   │   │
│  │   Vite       │◄──▶│   REST API   │◄──▶│ qwen2.5-coder  │   │
│  │   shadcn/ui  │    │   WebSocket  │    │ (chat model)    │   │
│  │   Nginx :80  │    │   :3000      │    │                 │   │
│  │   :8080      │    │              │    │ nomic-embed-text│   │
│  └──────┬───────┘    └──────┬───────┘    │ (embeddings)   │   │
│         │                   │            └──────┬──────────┘   │
│         │  REST /api/*     │                   │              │
│         │  WS /socket.io   │                   │              │
│  ┌──────┴───────┐    ┌──────┴───────┐          │              │
│  │  Browser     │    │  STT SERVICE │          │              │
│  │  Web Speech  │    │  Flask       │──────────┘              │
│  │  API (TTS)   │    │  Faster      │ (stt-service:8001)     │
│  │              │    │  Whisper base│                         │
│  └──────────────┘    └──────┬───────┘                         │
│                             │                                 │
│                    ┌────────┴────────┐                        │
│                    │   PostgreSQL    │                        │
│                    │   pgvector/pg16 │                        │
│                    │   :5432         │                        │
│                    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Services Breakdown

| Service | Technology | Role |
|---------|-----------|------|
| **frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand + Socket.IO Client + OGL (WebGL) | Single-page application — dashboard, interview room, history, profile |
| **backend** | NestJS 10 + TypeScript + Passport/JWT + Drizzle ORM + pg + Socket.IO | REST API + WebSocket gateway — authentication, interviews, evaluations, embeddings |
| **stt-service** | Python 3.11 + Flask + faster-whisper + gunicorn + ffmpeg | Speech-to-text microservice — converts user audio recordings into text |
| **ollama** | Ollama (latest) + qwen2.5-coder + nomic-embed-text | Local LLM server — powers the interviewer AI and generates semantic embeddings |
| **postgres** | pgvector/pg16 | Relational database with vector similarity search (HNSW indexes, 768d cosine distance) |

#### Communication Protocols

- **Frontend ↔ Backend (REST):** HTTP/1.1 via Axios. Used for auth (`/auth/*`), interview history (`/interviews/*`), profile (`/profile/*`), evaluations (`/evaluations/*`), and health checks. JWT tokens are passed in the `Authorization: Bearer` header and automatically attached via an Axios interceptor.

- **Frontend ↔ Backend (WebSocket):** Socket.IO over a single long-lived TCP connection. Used for real-time interview sessions: starting interviews, transmitting audio chunks, sending/receiving messages, and transcription results. The WebSocket connection authenticates via JWT token passed in the handshake `auth.token` or query parameter.

- **Backend ↔ Ollama:** HTTP via Axios. Two endpoints:
  - `POST /api/generate` — sends the interview prompt with conversation context tokens. Non-streaming, 120-second timeout. Returns the AI-generated text response and updated context.
  - `POST /api/embeddings` — sends text and returns a 768-dimensional vector for semantic search.

- **Backend ↔ STT Service:** HTTP via Axios. `POST /transcribe` sends raw audio bytes with `Content-Type: audio/webm`. The STT service converts to 16kHz mono WAV via ffmpeg, transcribes with Faster Whisper, and returns `{ "text": "..." }`.

- **Backend ↔ PostgreSQL:** Direct TCP connection via the `pg` driver, abstracted through Drizzle ORM. Uses pgvector extension for storing and querying 768-dimensional embeddings with HNSW indexes and cosine distance (`<=>` operator).

- **Frontend → Browser TTS:** The Web Speech API (`SpeechSynthesisUtterance`). No server-side TTS. Voice selection is based on the interviewer's gender (male/female), filtering system voices that match English and the appropriate gender.

#### Database Schema

The database consists of 5 tables:

- **users** — User accounts with email, password hash, name, improvement topics, stats
- **questions** — Seed question bank with topic, level, expected answer, evaluation criteria, and a 768d embedding vector for semantic similarity search
- **interviews** — Interview sessions with metadata (topic, level, interviewer name, duration), full message history (JSON and plain text), and a 768d embedding vector of the entire conversation
- **interview_messages** — Individual messages within an interview (role: user/ai, text, 768d embedding). Foreign key to interviews with cascade delete.
- **evaluations** — Post-intervention evaluations with overall score and per-question evaluation data (JSON)

#### WebSocket Protocol

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `start` | Client → Server | `{ topic, subtopic, level, duration, candidateName }` | Start a new interview session |
| `interview:started` | Server → Client | `{ interviewId, candidateName, interviewerName, interviewerGender, interviewerAvatar }` | Confirmation with generated interviewer persona |
| `ai:text` | Server → Client | `{ text, interviewerName?, interviewerGender?, interviewerAvatar? }` | AI-generated question or feedback |
| `ai:speaking` | Server → Client | `boolean` | AI speaking state indicator |
| `user:text` | Client → Server | `{ interviewId, id?, text }` | User's typed or transcribed response |
| `audio:chunk` | Client → Server | `{ interviewId, audio: ArrayBuffer }` | Real-time audio chunk during recording |
| `audio:transcribe` | Client → Server | `{ interviewId, id }` | Trigger Whisper transcription of accumulated chunks |
| `whisper:result` | Server → Client | `{ id, text, correcting? }` | Transcription result from the STT service |
| `end` | Client → Server | `{ interviewId }` | End the interview session |
| `interview:ended` | Server → Client | — | Interview ended confirmation |
| `ping` | Client → Server | — | Keepalive heartbeat |

#### Technical Decisions

- **No server-side TTS**: The Web Speech API is available in all modern browsers and requires zero server resources. Voice selection matches the randomly-generated interviewer persona (name, gender, avatar).

- **Conversation context via Ollama tokens**: Instead of sending the full message history on every turn, the backend stores Ollama's internal `context` token array in an in-memory Map. This reduces bandwidth and latency while maintaining coherence across turns.

- **Preloading optimization**: The configuration screen pre-emptively starts the interview via WebSocket when the user clicks "Start". The first AI message and interview ID are saved to `localStorage`, so the interview room renders instantly with no loading state.

- **Vector embeddings for semantic search**: Every question, message, and full interview transcript is embedded using `nomic-embed-text` (768d). This enables semantic similarity search across past interviews and question banks using pgvector's HNSW indexes.

---

### LLMs & Audio Pipeline

#### Models Used

| Model | Type | Purpose | Size | Provider |
|-------|------|---------|------|----------|
| **qwen2.5-coder** | Chat / Text generation | Conducts the interview — asks questions, gives feedback, evaluates answers | ~7GB (4-bit quantized) | Ollama (local) |
| **nomic-embed-text** | Embedding | Generates 768-dimensional vector embeddings for semantic search | ~274MB | Ollama (local) |
| **faster-whisper (base)** | Speech-to-text | Transcribes user audio recordings into text | ~150MB | CTranslate2 + OpenAI Whisper |

#### How They Communicate

##### Speech-to-Text Pipeline

```
User speaks into microphone
        │
        ▼
[Browser] MediaRecorder API captures audio
  - 250ms chunks
  - MIME type depends on browser:
    - Chrome: audio/webm;codecs=opus
    - Safari: audio/mp4, audio/webm
    - iOS: audio/mp4, audio/m4a
        │
        ▼  WebSocket (socket.io)
[Backend] Collects chunks, concatenates
        │
        ▼  HTTP POST (audio/webm)
[STT Service] Flask + faster-whisper
  1. Converts to 16kHz mono WAV via ffmpeg
  2. Transcribes with Whisper (beam_size=5, language='en')
  3. Returns { "text": "..." }
        │
        ▼  WebSocket
[Browser] Transcribed text appears in conversation log
        │
        ▼  user:text event
[Backend] Sends text to Ollama for AI response
```

##### Text-to-Speech Pipeline

```
[Backend] Ollama generates AI response text
        │
        ▼  WebSocket (ai:text event)
[Browser] Receives AI response text
        │
        ▼
[Browser] Web Speech API
  1. Creates SpeechSynthesisUtterance(response)
  2. Selects voice matching interviewer gender:
     - Female: filters for Samantha, Victoria, Karen, etc.
     - Male: filters for Daniel, Alex, David, Mark, etc.
  3. Speaks at rate=1.0, pitch=1.0
        │
        ▼
User hears the interviewer's question
```

##### Interview Flow (End to End)

1. User selects topic, subtopic, difficulty level, and duration
2. Backend generates an interviewer persona (random name, gender, avatar)
3. Backend calls Ollama with the interview system prompt (topic, level, rules)
4. Ollama returns the first question; backend sends it to the frontend via WebSocket
5. Browser reads the question aloud using Web Speech API TTS
6. User presses and holds the mic button to speak their answer
7. Audio chunks stream in real-time via WebSocket to the backend
8. When the user releases the mic, backend sends all chunks to the STT service
9. Faster Whisper transcribes the audio; result is sent back to the browser
10. The transcribed text is sent to Ollama for the next AI response
11. Steps 5-10 repeat until the interview ends (duration expires or user ends it)
12. After the interview, the backend evaluates each Q&A pair using Ollama with the evaluation prompt
13. Results (scores, strengths, improvements) are stored and displayed on the dashboard

---

### Project Structure

```
interviewed/
├── docker-compose.yml           # CPU-only setup
├── docker-compose.gpu.yml       # GPU-accelerated setup (NVIDIA)
├── entrypoint.sh                # Ollama startup script (auto-pulls model)
├── .env.example                 # Environment template
│
├── apps/
│   ├── backend/                 # NestJS API server
│   │   ├── src/
│   │   │   ├── auth/            # JWT authentication (register, login, me)
│   │   │   ├── interviews/      # Core interview logic
│   │   │   │   ├── ai/          # AI integration (Ollama, Whisper, prompts)
│   │   │   │   │   └── prompts/ # System & evaluation prompts
│   │   │   │   ├── interviews.gateway.ts  # WebSocket handler
│   │   │   │   ├── interviews.service.ts  # Business logic
│   │   │   │   └── interviews.repository.ts  # DB + vector search
│   │   │   ├── topics/          # Topic/subtopic definitions
│   │   │   ├── questions/       # Question bank service
│   │   │   ├── evaluations/     # Post-interview evaluation
│   │   │   ├── profile/         # User profile
│   │   │   ├── db/              # Drizzle schema + migrations
│   │   │   ├── config.ts        # Environment config loader
│   │   │   └── main.ts          # Bootstrap
│   │   ├── drizzle/             # SQL migration files
│   │   └── Dockerfile / .env.example
│   │
│   ├── frontend/                # React SPA
│   │   ├── src/
│   │   │   ├── pages/           # Login, Home, Config, Interview, History, Profile
│   │   │   ├── components/      # UI components (shadcn/ui + custom)
│   │   │   │   ├── interview/   # SpeakingCircle, ConversationLog, ConfigScreen, etc.
│   │   │   │   ├── dashboard/   # StatsCards, StreakBadge, SkillRadar, etc.
│   │   │   │   └── orb/         # WebGL animated background (OGL library)
│   │   │   ├── services/        # API clients, WebSocket, Audio (STT/TTS)
│   │   │   ├── stores/          # Zustand state management
│   │   │   ├── hooks/           # useAudio, useAuth, useWebSocket
│   │   │   └── types/           # TypeScript interfaces
│   │   ├── nginx.conf           # Nginx config (SPA + proxy)
│   │   └── Dockerfile
│   │
│   └── stt-service/             # Python speech-to-text microservice
│       ├── app.py               # Flask + Faster Whisper
│       ├── Dockerfile
│       └── requirements.txt
│
└── docs/
    └── bugs/
```

### Topics Available

| Topic | Subtopics |
|-------|-----------|
| **Soft Skills** | Elevator Pitch, STAR Method, Cultural Fit, Future Goals, Tricky Questions |
| **Frontend** | React, HTML, JavaScript, Tailwind, CSS, TypeScript |
| **Backend** | Node.js, Python, NestJS |
| **FullStack** | Next.js, Express |
| **DevOps** | Docker, Kubernetes, CI/CD, AWS |
| **Database** | PostgreSQL, MongoDB, Redis, SQL |

### Evaluation System

After an interview, the backend automatically evaluates each Q&A pair:

1. Extracts all question-answer pairs from the conversation
2. For each pair, sends a structured evaluation prompt to Ollama requesting JSON output
3. Ollama returns: `{ "score": 0-100, "strengths": [...], "improvements": [...], "feedback": "..." }`
4. An overall score is computed (average of all question scores)
5. Results are stored in the `evaluations` table and displayed on the dashboard with a radar chart

The evaluation uses expected answers and criteria from the seed question bank (186 questions covering React, TypeScript, Node.js, PostgreSQL, Docker, and more).

### Security

- **JWT authentication**: All REST API endpoints (except register/login) require a valid JWT token. WebSocket connections also authenticate via JWT.
- **Password hashing**: Passwords are hashed using bcrypt before storage.
- **100% local**: No external API calls. All models run locally via Ollama. Audio data is processed entirely within Docker containers.
- **No data exfiltration**: The application has no telemetry, analytics, or external network calls beyond the Docker internal network.

---

---

## Português

### Por que AI Interviewed Me?

Conseguir uma vaga de engenharia de software exige preparação. Horas infinitas de estudo, dezenas de simulações de entrevistas, e o pior de tudo — nunca saber se você está realmente pronto.

O **AI Interviewed Me** é um simulador de entrevistas com IA que parece real. Ele faz perguntas técnicas e comportamentais dinâmicas, ouve suas respostas faladas, as transcreve em tempo real, avalia suas respostas e fala de volta — exatamente como um entrevistador de verdade.

| Funcionalidade | Benefício |
|----------------|-----------|
| **Voz em primeiro lugar** | Responda naturalmente falando. Áudio transcrito localmente via Whisper. |
| **Perguntas adaptativas** | IA gera perguntas dinamicamente — sem bancos de perguntas estáticos. |
| **Avaliação instantânea** | Receba notas para cada resposta logo após a entrevista. |
| **TTS em tempo real** | O entrevistador lê as perguntas em voz alta via síntese de fala do navegador. |
| **Múltiplos tópicos** | Frontend, Backend, FullStack, DevOps, Banco de Dados, Soft Skills. |
| **Todos os níveis** | Entry, Junior, Mid, Pleno, Senior — cada um com dificuldade adequada. |
| **Histórico e estatísticas** | Acompanhe streaks, gráfico radar de habilidades e áreas de melhoria. |
| **100% privado** | Tudo roda localmente via Docker + Ollama. Nenhum dado sai da sua máquina. |
| **Grátis e open source** | Sem custos de API. Auto-hospedado. Sem vendor lock-in. |

---

### Como Usar Localmente

#### Pré-requisitos

- Docker & Docker Compose (v2+)
- Mínimo 8GB de RAM (16GB recomendado)
- ~10GB de espaço livre em disco para imagens Docker + modelos LLM

#### Início Rápido

```bash
# 1. Clone o repositório
git clone <repo-url>
cd interviewed

# 2. Configure o ambiente
cp .env.example .env
# Edite .env e defina um JWT_SECRET forte

# 3. Inicie todos os serviços (CPU)
docker compose up -d

# Ou com suporte a GPU NVIDIA:
# docker compose -f docker-compose.gpu.yml up -d

# 4. Baixe o modelo LLM (aguarde ~30s para o Ollama iniciar)
docker exec -it interviewed-ollama ollama pull qwen2.5-coder

# 5. Abra o aplicativo
open http://localhost:8080
```

#### Pontos de Acesso

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| Ollama API | http://localhost:11434 |
| STT Service | http://localhost:8001 |

#### Comandos Úteis

```bash
# Ver logs
docker compose logs -f

# Reconstruir após alterações
docker compose up -d --build

# Parar tudo
docker compose down

# Limpeza total (remove volumes)
docker compose down -v

# Executar shell no backend
docker exec -it interviewed-backend sh

# Listar modelos Ollama
docker exec -it interviewed-ollama ollama list

# Testar Ollama diretamente
docker exec -it interviewed-ollama ollama run qwen2.5-coder "Hello"
```

#### Desenvolvimento Sem Docker

```bash
# Backend (requer PostgreSQL + Ollama rodando localmente)
cd apps/backend
npm install
npm run start:dev

# Frontend (Vite dev server com proxy para localhost:3000)
cd apps/frontend
npm install
npm run dev

# STT Service (requer Python 3.11 + ffmpeg)
cd apps/stt-service
pip install -r requirements.txt
python app.py
```

---

### Arquitetura & System Design

#### Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCKER NETWORK                               │
│                  (interviewed-network)                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │   FRONTEND   │    │   BACKEND    │    │    OLLAMA       │   │
│  │   React 18   │    │   NestJS 10  │    │ ─────────────   │   │
│  │   Vite       │◄──▶│   REST API   │◄──▶│ qwen2.5-coder  │   │
│  │   shadcn/ui  │    │   WebSocket  │    │ (chat model)    │   │
│  │   Nginx :80  │    │   :3000      │    │                 │   │
│  │   :8080      │    │              │    │ nomic-embed-text│   │
│  └──────┬───────┘    └──────┬───────┘    │ (embeddings)   │   │
│         │                   │            └──────┬──────────┘   │
│         │  REST /api/*     │                   │              │
│         │  WS /socket.io   │                   │              │
│  ┌──────┴───────┐    ┌──────┴───────┐          │              │
│  │  Browser     │    │  STT SERVICE │          │              │
│  │  Web Speech  │    │  Flask       │──────────┘              │
│  │  API (TTS)   │    │  Faster      │ (stt-service:8001)     │
│  │              │    │  Whisper base│                         │
│  └──────────────┘    └──────┬───────┘                         │
│                             │                                 │
│                    ┌────────┴────────┐                        │
│                    │   PostgreSQL    │                        │
│                    │   pgvector/pg16 │                        │
│                    │   :5432         │                        │
│                    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Serviços

| Serviço | Tecnologia | Função |
|---------|-----------|--------|
| **frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand + Socket.IO Client + OGL (WebGL) | Interface de usuário SPA — dashboard, sala de entrevista, histórico, perfil |
| **backend** | NestJS 10 + TypeScript + Passport/JWT + Drizzle ORM + pg + Socket.IO | API REST + gateway WebSocket — autenticação, entrevistas, avaliações, embeddings |
| **stt-service** | Python 3.11 + Flask + faster-whisper + gunicorn + ffmpeg | Microsserviço de fala-para-texto — converte áudio do usuário em texto |
| **ollama** | Ollama (latest) + qwen2.5-coder + nomic-embed-text | Servidor LLM local — alimenta a IA entrevistadora e gera embeddings semânticos |
| **postgres** | pgvector/pg16 | Banco de dados relacional com busca por similaridade vetorial (índices HNSW, distância cosseno 768d) |

#### Protocolos de Comunicação

- **Frontend ↔ Backend (REST):** HTTP/1.1 via Axios. Usado para autenticação (`/auth/*`), histórico de entrevistas (`/interviews/*`), perfil (`/profile/*`), avaliações (`/evaluations/*`) e health checks. Tokens JWT são passados no header `Authorization: Bearer` e automaticamente anexados via interceptador Axios.

- **Frontend ↔ Backend (WebSocket):** Socket.IO sobre uma única conexão TCP de longa duração. Usado para sessões de entrevista em tempo real: iniciar entrevistas, transmitir chunks de áudio, enviar/receber mensagens e resultados de transcrição. A conexão WebSocket autentica via token JWT passado no handshake (`auth.token` ou parâmetro de query).

- **Backend ↔ Ollama:** HTTP via Axios. Dois endpoints:
  - `POST /api/generate` — envia o prompt da entrevista com tokens de contexto da conversa. Sem streaming, timeout de 120 segundos. Retorna a resposta de texto gerada pela IA e o contexto atualizado.
  - `POST /api/embeddings` — envia texto e retorna um vetor de 768 dimensões para busca semântica.

- **Backend ↔ STT Service:** HTTP via Axios. `POST /transcribe` envia bytes de áudio brutos com `Content-Type: audio/webm`. O STT service converte para WAV mono 16kHz via ffmpeg, transcreve com Faster Whisper e retorna `{ "text": "..." }`.

- **Backend ↔ PostgreSQL:** Conexão TCP direta via driver `pg`, abstraída através do Drizzle ORM. Usa a extensão pgvector para armazenar e consultar embeddings de 768 dimensões com índices HNSW e distância cosseno (operador `<=>`).

- **Frontend → TTS no Navegador:** A Web Speech API (`SpeechSynthesisUtterance`). Sem TTS no servidor. A seleção de voz é baseada no gênero do entrevistador (masculino/feminino), filtrando vozes do sistema que correspondam ao inglês e ao gênero apropriado.

#### Esquema do Banco de Dados

O banco de dados consiste em 5 tabelas:

- **users** — Contas de usuário com email, hash de senha, nome, tópicos de melhoria, estatísticas
- **questions** — Banco de perguntas inicial com tópico, nível, resposta esperada, critérios de avaliação e um vetor de embedding 768d para busca por similaridade semântica
- **interviews** — Sessões de entrevista com metadados (tópico, nível, nome do entrevistador, duração), histórico completo de mensagens (JSON e texto puro) e um vetor de embedding 768d da conversa inteira
- **interview_messages** — Mensagens individuais dentro de uma entrevista (papel: user/ai, texto, embedding 768d). Chave estrangeira para interviews com delete em cascata.
- **evaluations** — Avaliações pós-entrevista com nota geral e dados de avaliação por pergunta (JSON)

#### Protocolo WebSocket

| Evento | Direção | Payload | Propósito |
|--------|---------|---------|-----------|
| `start` | Cliente → Servidor | `{ topic, subtopic, level, duration, candidateName }` | Iniciar nova sessão de entrevista |
| `interview:started` | Servidor → Cliente | `{ interviewId, candidateName, interviewerName, interviewerGender, interviewerAvatar }` | Confirmação com persona do entrevistador gerada |
| `ai:text` | Servidor → Cliente | `{ text, interviewerName?, interviewerGender?, interviewerAvatar? }` | Pergunta ou feedback gerado pela IA |
| `ai:speaking` | Servidor → Cliente | `boolean` | Indicador de estado de fala da IA |
| `user:text` | Cliente → Servidor | `{ interviewId, id?, text }` | Resposta digitada ou transcrita do usuário |
| `audio:chunk` | Cliente → Servidor | `{ interviewId, audio: ArrayBuffer }` | Chunk de áudio em tempo real durante a gravação |
| `audio:transcribe` | Cliente → Servidor | `{ interviewId, id }` | Acionar transcrição Whisper dos chunks acumulados |
| `whisper:result` | Servidor → Cliente | `{ id, text, correcting? }` | Resultado da transcrição do STT service |
| `end` | Cliente → Servidor | `{ interviewId }` | Encerrar sessão de entrevista |
| `interview:ended` | Servidor → Cliente | — | Confirmação de entrevista encerrada |
| `ping` | Cliente → Servidor | — | Heartbeat keepalive |

#### Decisões Técnicas

- **Sem TTS no servidor**: A Web Speech API está disponível em todos os navegadores modernos e não requer recursos do servidor. A seleção de voz corresponde à persona do entrevistador gerada aleatoriamente (nome, gênero, avatar).

- **Contexto da conversa via tokens do Ollama**: Em vez de enviar o histórico completo de mensagens a cada turno, o backend armazena o array de tokens de contexto interno do Ollama em um Map em memória. Isso reduz banda e latência enquanto mantém a coerência entre turnos.

- **Otimização de pré-carregamento**: A tela de configuração inicia a entrevista preventivamente via WebSocket quando o usuário clica em "Start". A primeira mensagem da IA e o ID da entrevista são salvos no `localStorage`, então a sala de entrevista renderiza instantaneamente sem estado de carregamento.

- **Embeddings vetoriais para busca semântica**: Cada pergunta, mensagem e transcrição completa de entrevista é embedded usando `nomic-embed-text` (768d). Isso permite busca por similaridade semântica em entrevistas passadas e bancos de perguntas usando índices HNSW do pgvector.

---

### LLMs e Pipeline de Áudio

#### Modelos Utilizados

| Modelo | Tipo | Propósito | Tamanho | Provedor |
|--------|------|-----------|---------|----------|
| **qwen2.5-coder** | Chat / Geração de texto | Conduz a entrevista — faz perguntas, dá feedback, avalia respostas | ~7GB (quantizado 4-bit) | Ollama (local) |
| **nomic-embed-text** | Embedding | Gera embeddings vetoriais de 768 dimensões para busca semântica | ~274MB | Ollama (local) |
| **faster-whisper (base)** | Fala-para-texto | Transcreve gravações de áudio do usuário em texto | ~150MB | CTranslate2 + OpenAI Whisper |

#### Como Eles se Comunicam

##### Pipeline de Fala-para-Texto (STT)

```
Usuário fala no microfone
        │
        ▼
[Navegador] MediaRecorder API captura áudio
  - Chunks de 250ms
  - Tipo MIME depende do navegador:
    - Chrome: audio/webm;codecs=opus
    - Safari: audio/mp4, audio/webm
    - iOS: audio/mp4, audio/m4a
        │
        ▼  WebSocket (socket.io)
[Backend] Coleta chunks, concatena
        │
        ▼  HTTP POST (audio/webm)
[STT Service] Flask + faster-whisper
  1. Converte para WAV mono 16kHz via ffmpeg
  2. Transcreve com Whisper (beam_size=5, language='en')
  3. Retorna { "text": "..." }
        │
        ▼  WebSocket
[Navegador] Texto transcrito aparece no log da conversa
        │
        ▼  Evento user:text
[Backend] Envia texto para Ollama gerar resposta da IA
```

##### Pipeline de Texto-para-Fala (TTS)

```
[Backend] Ollama gera texto de resposta da IA
        │
        ▼  WebSocket (evento ai:text)
[Navegador] Recebe texto de resposta da IA
        │
        ▼
[Navegador] Web Speech API
  1. Cria SpeechSynthesisUtterance(resposta)
  2. Seleciona voz correspondente ao gênero do entrevistador:
     - Feminino: filtra por Samantha, Victoria, Karen, etc.
     - Masculino: filtra por Daniel, Alex, David, Mark, etc.
  3. Fala com rate=1.0, pitch=1.0
        │
        ▼
Usuário ouve a pergunta do entrevistador
```

##### Fluxo da Entrevista (Ponta a Ponta)

1. Usuário seleciona tópico, subtópico, nível de dificuldade e duração
2. Backend gera uma persona de entrevistador (nome, gênero e avatar aleatórios)
3. Backend chama o Ollama com o prompt de sistema da entrevista (tópico, nível, regras)
4. Ollama retorna a primeira pergunta; backend envia ao frontend via WebSocket
5. Navegador lê a pergunta em voz alta usando Web Speech API TTS
6. Usuário pressiona e segura o botão do microfone para falar sua resposta
7. Chunks de áudio são transmitidos em tempo real via WebSocket para o backend
8. Quando o usuário solta o microfone, o backend envia todos os chunks para o STT service
9. Faster Whisper transcreve o áudio; o resultado é enviado de volta ao navegador
10. O texto transcrito é enviado ao Ollama para a próxima resposta da IA
11. Passos 5-10 se repetem até a entrevista terminar (duração expira ou usuário encerra)
12. Após a entrevista, o backend avalia cada par pergunta-resposta usando Ollama com o prompt de avaliação
13. Resultados (notas, pontos fortes, melhorias) são armazenados e exibidos no dashboard

---

### Estrutura do Projeto

```
interviewed/
├── docker-compose.yml           # Configuração apenas CPU
├── docker-compose.gpu.yml       # Configuração com aceleração GPU (NVIDIA)
├── entrypoint.sh                # Script de inicialização do Ollama
├── .env.example                 # Template de ambiente
│
├── apps/
│   ├── backend/                 # Servidor API NestJS
│   │   ├── src/
│   │   │   ├── auth/            # Autenticação JWT (register, login, me)
│   │   │   ├── interviews/      # Lógica principal de entrevistas
│   │   │   │   ├── ai/          # Integração com IA (Ollama, Whisper, prompts)
│   │   │   │   │   └── prompts/ # Prompts de sistema e avaliação
│   │   │   │   ├── interviews.gateway.ts  # Manipulador WebSocket
│   │   │   │   ├── interviews.service.ts  # Lógica de negócio
│   │   │   │   └── interviews.repository.ts  # DB + busca vetorial
│   │   │   ├── topics/          # Definições de tópicos/subtópicos
│   │   │   ├── questions/       # Serviço de banco de perguntas
│   │   │   ├── evaluations/     # Avaliação pós-entrevista
│   │   │   ├── profile/         # Perfil do usuário
│   │   │   ├── db/              # Schema Drizzle + migrações
│   │   │   ├── config.ts        # Carregador de configuração de ambiente
│   │   │   └── main.ts          # Bootstrap
│   │   ├── drizzle/             # Arquivos de migração SQL
│   │   └── Dockerfile / .env.example
│   │
│   ├── frontend/                # React SPA
│   │   ├── src/
│   │   │   ├── pages/           # Login, Home, Config, Interview, History, Profile
│   │   │   ├── components/      # Componentes de UI (shadcn/ui + customizados)
│   │   │   │   ├── interview/   # SpeakingCircle, ConversationLog, ConfigScreen, etc.
│   │   │   │   ├── dashboard/   # StatsCards, StreakBadge, SkillRadar, etc.
│   │   │   │   └── orb/         # Fundo animado WebGL (biblioteca OGL)
│   │   │   ├── services/        # Clientes API, WebSocket, Áudio (STT/TTS)
│   │   │   ├── stores/          # Gerenciamento de estado com Zustand
│   │   │   ├── hooks/           # useAudio, useAuth, useWebSocket
│   │   │   └── types/           # Interfaces TypeScript
│   │   ├── nginx.conf           # Config Nginx (SPA + proxy)
│   │   └── Dockerfile
│   │
│   └── stt-service/             # Microsserviço Python de fala-para-texto
│       ├── app.py               # Flask + Faster Whisper
│       ├── Dockerfile
│       └── requirements.txt
│
└── docs/
    └── bugs/
```

### Tópicos Disponíveis

| Tópico | Subtópicos |
|--------|------------|
| **Soft Skills** | Elevator Pitch, STAR Method, Cultural Fit, Future Goals, Tricky Questions |
| **Frontend** | React, HTML, JavaScript, Tailwind, CSS, TypeScript |
| **Backend** | Node.js, Python, NestJS |
| **FullStack** | Next.js, Express |
| **DevOps** | Docker, Kubernetes, CI/CD, AWS |
| **Database** | PostgreSQL, MongoDB, Redis, SQL |

### Sistema de Avaliação

Após uma entrevista, o backend avalia automaticamente cada par pergunta-resposta:

1. Extrai todos os pares pergunta-resposta da conversa
2. Para cada par, envia um prompt de avaliação estruturado para o Ollama solicitando saída JSON
3. Ollama retorna: `{ "score": 0-100, "strengths": [...], "improvements": [...], "feedback": "..." }`
4. Uma nota geral é calculada (média das notas de todas as perguntas)
5. Resultados são armazenados na tabela `evaluations` e exibidos no dashboard com gráfico radar

A avaliação usa respostas esperadas e critérios do banco de perguntas inicial (186 perguntas cobrindo React, TypeScript, Node.js, PostgreSQL, Docker, e mais).

### Segurança

- **Autenticação JWT**: Todos os endpoints da API REST (exceto register/login) exigem um token JWT válido. Conexões WebSocket também autenticam via JWT.
- **Hash de senhas**: Senhas são hasheadas usando bcrypt antes do armazenamento.
- **100% local**: Nenhuma chamada de API externa. Todos os modelos rodam localmente via Ollama. Dados de áudio são processados inteiramente dentro dos contêineres Docker.
- **Sem exfiltração de dados**: O aplicativo não possui telemetria, analytics ou chamadas de rede externas além da rede interna do Docker.
