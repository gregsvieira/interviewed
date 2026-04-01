import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as toml from 'toml';

interface Config {
  PORT: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  STORAGE_PATH: string;
  STT_SERVICE_URL: string;
}

let config: Config;

try {
  if (existsSync('.env')) {
    const content = readFileSync('.env', 'utf-8');
    const parsed = toml.parse(content);
    config = parsed as Config;
  } else {
    config = {
      PORT: process.env.PORT || '3000',
      JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5-coder',
      STORAGE_PATH: process.env.STORAGE_PATH || '~/.interviewed',
      STT_SERVICE_URL: process.env.STT_SERVICE_URL || 'http://localhost:8001',
    };
  }
} catch {
  config = {
    PORT: process.env.PORT || '3000',
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5-coder',
    STORAGE_PATH: process.env.STORAGE_PATH || '~/.interviewed',
    STT_SERVICE_URL: process.env.STT_SERVICE_URL || 'http://localhost:8001',
  };
}

export const storagePath = resolve(
  process.env.HOME || '.',
  '.interviewed'
);

export { config };
