#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5-coder}"
WHISPER_MODEL="whisper-small"

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

echo "Checking if model $WHISPER_MODEL exists..."
if ! ollama list | grep -q "$WHISPER_MODEL"; then
    echo "Model $WHISPER_MODEL not found. Downloading..."
    ollama pull "$WHISPER_MODEL"
    echo "Whisper model downloaded."
else
    echo "Whisper model $WHISPER_MODEL already exists."
fi

echo "Ollama server running. PID: $SERVER_PID"
wait $SERVER_PID
