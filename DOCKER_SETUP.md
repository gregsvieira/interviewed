# AI INTERVIEWD - Docker Setup

## Quick Start

### 1. Initial config

```bash
# Copy the example file.
cp .env.example .env

# Edit the .env file and set a strong secret key.
nano .env
```

### 2. Subir a Aplicação

**With CPU:**
```bash
docker compose up -d
```

**With GPU (GPU):**
```bash
docker compose -f docker-compose.gpu.yml up -d
```

### 3. Download the AI ​​Model

```bash
# Wait for Ollama to start (~30 seconds)
docker compose logs -f ollama

# When it's running, download the model:
docker exec -it interviewed-ollama ollama pull qwen2.5-coder

# The model has approximately 7GB of RAM; it may take a few minutes depending on the connection.
```

### 4. Access the Application

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Ollama API:** http://localhost:11434

---

## Useful Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

### Rebuild after changes
```bash
docker compose up -d --build
```

### Stop application
```bash
docker compose down
```

### Stop and clean volumes (COMPLETE CLEANING)
```bash
docker compose down -v
```

### Restart services
```bash
docker compose restart
docker compose restart backend
```

### Execute commands in the container.
```bash
# Backend shell
docker exec -it interviewed-backend sh

# View installed model
docker exec -it interviewed-ollama ollama list

# Test Ollama
docker exec -it interviewed-ollama ollama run qwen2.5-coder "Hello"
```

---

## Container Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                         │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   Frontend   │   │   Backend    │   │    Ollama    │   │
│  │   (Nginx)    │   │   (NestJS)   │   │   (LLM)      │   │
│  │              │   │              │   │              │   │
│  │  Port: 8080 │   │  Port: 3000  │   │  Port: 11434 │   │
│  └──────────────┘   └──────┬───────┘   └──────┬───────┘   │
│                            │                   │           │
└────────────────────────────┼───────────────────┼───────────┘
                             │                   │
                      Proxy/Api calls     LLM inference
```

---

## Troubleshooting

### Ollama does not initiate
```bash
# Verify logs
docker compose logs ollama

# Restart
docker compose restart ollama
```

### Backend not connecting to Ollama
```bash
# Check if Ollama is running
docker exec -it interviewed-ollama curl http://localhost:11434/api/tags

# Check environment variables in the backend
docker exec -it interviewed-backend env | grep OLLAMA
```

### Frontend not loading
```bash
# Verify logs
docker compose logs frontend

# Rebuild
docker compose up -d --build frontend
```

### Problemas de Permissão
```bash
# Correct volume permissions
docker compose down
sudo chown -R $(id -u):$(id -g) ~/.interviewed 2>/dev/null || true
docker compose up -d
```

---

## Prodution

For production deployment:

1. **Change JWT_SECRET** in `.env`
2. **Use HTTPS** (configure reverse proxy)
3. **Consider external volumes.** for persistence
4. **Monitor resources** of containers
5. **Configure backup** of volume `interviewed-data`
