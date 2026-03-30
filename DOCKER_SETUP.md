# Entrevista IA - Docker Setup

## Quick Start

### 1. Configuração Inicial

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o .env e defina uma chave secreta forte
nano .env
```

### 2. Subir a Aplicação

**Com GPU NVIDIA:**
```bash
docker compose up -d
```

**Sem GPU (CPU Only):**
```bash
docker compose -f docker-compose.cpu.yml up -d
```

### 3. Baixar o Modelo de IA

```bash
# Aguarde o Ollama iniciar (~30 segundos)
docker compose logs -f ollama

# Quando estiver rodando, baixe o modelo:
docker exec -it interviewed-ollama ollama pull qwen2.5-coder

# O modelo tem ~7GB, pode levar alguns minutos dependendo da conexão
```

### 4. Acessar a Aplicação

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Ollama API:** http://localhost:11434

---

## Comandos Úteis

### Ver Logs
```bash
# Todos os serviços
docker compose logs -f

# Serviço específico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

### Rebuild após mudanças
```bash
docker compose up -d --build
```

### Parar a aplicação
```bash
docker compose down
```

### Parar e remover volumes (LIMPEZA TOTAL)
```bash
docker compose down -v
```

### Reiniciar serviços
```bash
docker compose restart
docker compose restart backend
```

### Executar comandos no container
```bash
# Backend shell
docker exec -it interviewed-backend sh

# Ver modelo instalado
docker exec -it interviewed-ollama ollama list

# Testar Ollama
docker exec -it interviewed-ollama ollama run qwen2.5-coder "Hello"
```

---

## Estrutura dos Containers

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

### Ollama não inicia
```bash
# Verifique logs
docker compose logs ollama

# Reinicie
docker compose restart ollama
```

### Backend não conecta com Ollama
```bash
# Verifique se Ollama está rodando
docker exec -it interviewed-ollama curl http://localhost:11434/api/tags

# Verifique variáveis de ambiente no backend
docker exec -it interviewed-backend env | grep OLLAMA
```

### Frontend não carrega
```bash
# Verifique logs
docker compose logs frontend

# Rebuild
docker compose up -d --build frontend
```

### Problemas de Permissão
```bash
# Corrija permissões do volume
docker compose down
sudo chown -R $(id -u):$(id -g) ~/.interviewed 2>/dev/null || true
docker compose up -d
```

---

## Produção

Para deploy em produção:

1. **Mude o JWT_SECRET** no `.env`
2. **Use HTTPS** (configure proxy reverso)
3. **Considere volumes externos** para persistência
4. **Monitore recursos** dos containers
5. **Configure backup** do volume `interviewed-data`
