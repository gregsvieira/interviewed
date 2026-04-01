#!/bin/bash

MODEL="${OLLAMA_MODEL:-qwen2.5-coder}"
WHISPER_MODEL="whisper-small"

echo "Starting Ollama server..."
ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Ollama failed to start after 30 seconds"
        exit 1
    fi
    sleep 1
done

echo "Checking if model $MODEL exists..."
if ! ollama list | grep -q "$MODEL"; then
    echo "Model $MODEL not found. Downloading..."
    ollama pull "$MODEL"
    echo "Model $MODEL downloaded."
else
    echo "Model $MODEL already exists."
fi

echo "Checking if model $WHISPER_MODEL exists..."
if ! ollama list | grep -q "$WHISPER_MODEL"; then
    echo "Model $WHISPER_MODEL not found. Downloading..."
    ollama pull "$WHISPER_MODEL"
    echo "Whisper model downloaded."
else
    echo "Whisper model $WHISPER_MODEL already exists."
fi

echo "All models ready. Keeping Ollama server running..."
wait $SERVER_PID
