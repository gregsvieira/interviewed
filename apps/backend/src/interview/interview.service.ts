import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config';
import { StorageService } from '../storage/storage.service';
import { AIService } from './ai/ai.service';
import { generateInterviewer, generateRandomName, InterviewerInfo, Message } from './ai/prompts/interview.prompt';

export interface InterviewMessage {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface Interview {
  id: string;
  userId: string;
  topic: string;
  subtopic: string;
  level: string;
  candidateName: string;
  interviewer: InterviewerInfo;
  duration: number;
  messages: InterviewMessage[];
  startedAt: Date;
  endedAt?: Date;
}

@Injectable()
export class InterviewService {
  private currentInterviews: Map<string, Interview> = new Map();

  constructor(
    private storage: StorageService,
    private aiService: AIService,
    private jwtService: JwtService,
  ) {}

  async startInterview(
    id: string,
    userId: string,
    topic: string,
    subtopic: string,
    level: string,
    duration: number = 30,
    candidateName?: string,
  ): Promise<{ firstMessage: string; candidateName: string; interviewer: InterviewerInfo }> {
    const finalCandidateName = candidateName || generateRandomName();
    const interviewer = generateInterviewer();
    
    const interview: Interview = {
      id,
      userId,
      topic,
      subtopic,
      level,
      candidateName: finalCandidateName,
      interviewer,
      duration,
      messages: [],
      startedAt: new Date(),
    };

    this.currentInterviews.set(id, interview);

    const firstMessage = await this.aiService.generateResponse(
      id,
      topic,
      subtopic,
      level,
      finalCandidateName,
      interviewer.name,
      [],
    );

    interview.messages.push({
      role: 'ai',
      text: firstMessage,
      timestamp: new Date(),
    });

    return { firstMessage, candidateName: finalCandidateName, interviewer };
  }

  async processUserMessage(interviewId: string, userText: string): Promise<string> {
    const interview = this.currentInterviews.get(interviewId);
    if (!interview) throw new Error('Interview not found');

    interview.messages.push({
      role: 'user',
      text: userText,
      timestamp: new Date(),
    });

    const previousMessages: Message[] = interview.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'ai',
      content: m.text,
    }));

    const response = await this.aiService.generateResponse(
      interviewId,
      interview.topic,
      interview.subtopic,
      interview.level,
      interview.candidateName,
      interview.interviewer.name,
      previousMessages,
    );

    interview.messages.push({
      role: 'ai',
      text: response,
      timestamp: new Date(),
    });

    return response;
  }

  async endInterview(interviewId: string): Promise<void> {
    const interview = this.currentInterviews.get(interviewId);
    if (!interview) return;

    interview.endedAt = new Date();
    this.aiService.clearContext(interviewId);

    await this.storage.save('interviews', interviewId, interview);
    this.currentInterviews.delete(interviewId);
  }

  async getInterviewHistory(userId: string): Promise<Interview[]> {
    const allInterviews = await this.storage.getAll<Interview>('interviews');
    return allInterviews
      .filter(i => i.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getInterview(interviewId: string): Promise<Interview | null> {
    return this.storage.get<Interview>('interviews', interviewId);
  }

  async validateToken(token: string): Promise<{ id: string; email: string }> {
    const payload = this.jwtService.verify(token, {
      secret: config.JWT_SECRET,
    });
    return { id: payload.sub, email: payload.email };
  }

  getActiveInterview(interviewId: string): Interview | undefined {
    return this.currentInterviews.get(interviewId);
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    console.log('[InterviewService] transcribeAudio called with', audioBuffer.length, 'bytes');
    
    if (audioBuffer.length === 0) {
      return '';
    }

    try {
      const transcription = await this.aiService.transcribeAudio(audioBuffer);
      return transcription;
    } catch (error) {
      console.error('[InterviewService] Transcription error:', error);
      return '';
    }
  }
}
