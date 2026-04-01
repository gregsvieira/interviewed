import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { config } from '../../config';
import * as fs from 'fs';
import * as path from 'path';

export interface OllamaResponse {
  response: string;
  context: number[];
}

@Injectable()
export class OllamaService {
  private baseUrl: string;
  private model: string;
  private sttServiceUrl: string;

  constructor() {
    this.baseUrl = config.OLLAMA_BASE_URL;
    this.model = config.OLLAMA_MODEL;
    this.sttServiceUrl = config.STT_SERVICE_URL;
  }

  async generate(prompt: string, context?: number[]): Promise<OllamaResponse> {
    const requestBody: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
    };

    if (context && context.length > 0) {
      requestBody.context = context;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, requestBody, {
        timeout: 120000,
      });

      return {
        response: response.data.response,
        context: response.data.context || [],
      };
    } catch (error) {
      console.error('Ollama error:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Ollama error: ${error.response.status} - ${error.response.statusText}`);
      }
      throw new Error('Failed to generate response from Ollama');
    }
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    console.log('[OllamaService] Starting transcription via faster-whisper service, audio size:', audioBuffer.length, 'bytes');
    
    try {
      console.log('[OllamaService] Sending request to STT service:', this.sttServiceUrl);
      
      const response = await axios.post(`${this.sttServiceUrl}/transcribe`, audioBuffer, {
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: {
          'Content-Type': 'audio/webm',
        },
      });

      console.log('[OllamaService] Transcription response:', response.data);
      
      return response.data?.text || '';
    } catch (error) {
      console.error('[OllamaService] Transcription error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('[OllamaService] Axios error details:', error.response?.data);
      }
      
      return '';
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }
}
