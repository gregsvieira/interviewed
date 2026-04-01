#!/bin/bash

MODEL="${OLLAMA_MODEL:-qwen2.5-coder}"

echo "Starting Ollama server..."
ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama to be ready (max 120 seconds)..."
for i in {1..60}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama server is ready! (took ${i}s)"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "Ollama failed to start after 60 seconds, continuing anyway..."
    fi
    sleep 2
done

echo "Checking if model $MODEL exists..."
if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo "Model $MODEL not found. Downloading..."
    ollama pull "$MODEL"
    echo "Model $MODEL downloaded."
else
    echo "Model $MODEL already exists."
fi

echo "All models ready. Keeping Ollama server running..."
wait $SERVER_PID
