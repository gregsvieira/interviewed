#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5-coder}"

echo "Starting Ollama server in background..."
ollama serve &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 5

echo "Checking if model $MODEL exists..."
if ! ollama list | grep -q "$MODEL"; then
    echo "Model $MODEL not found. Downloading..."
    ollama pull "$MODEL"
    echo "Model downloaded."
else
    echo "Model $MODEL already exists."
fi

echo "Ollama server running. PID: $SERVER_PID"
wait $SERVER_PID
