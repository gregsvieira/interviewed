# ============================================
# Interviewed - Dev Environment
# ============================================

# Crie um arquivo .env na raiz com:
# JWT_SECRET=sua-chave-secreta-aqui

# Para iniciar (com GPU NVIDIA):
docker compose -f docker-compose.gpu.yml up -d

# Para iniciar (sem GPU - CPU only):
docker compose up -d

# Ver logs:
docker compose logs -f

# Parar:
docker compose down

# Rebuild após mudanças:
docker compose up -d --build

# Baixar modelo Ollama (execute após subir):
docker exec -it interviewed-ollama ollama pull qwen2.5-coder

# URLs:
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
# Ollama API: http://localhost:11434
