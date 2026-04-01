import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { JwtService } from '@nestjs/jwt';

interface ActiveInterview {
  socketId: string;
  userId: string;
  audioChunks: any[];
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class InterviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeInterviews: Map<string, ActiveInterview> = new Map();

  constructor(
    private interviewService: InterviewService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    console.log('=== Client connecting:', client.id);
    console.log('    handshake:', JSON.stringify(client.handshake));
    try {
      const token = client.handshake.auth?.token;
      const queryToken = client.handshake.query?.token;
      console.log('    token (auth):', token ? 'yes' : 'no');
      console.log('    token (query):', queryToken ? 'yes' : 'no');
      
      const finalToken = token || queryToken;
      if (!finalToken) {
        console.log('    No token, allowing connection anyway for testing');
        client.data.user = { id: 'test-user' };
        return;
      }

      const user = await this.interviewService.validateToken(finalToken as string);
      console.log('    User validated:', user);
      client.data.user = user;
      console.log('    Connection accepted!');
    } catch (error) {
      console.error('    Connection error:', error);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const interviewId = [...this.activeInterviews.entries()]
      .find(([, interview]) => interview.socketId === client.id)?.[0];

    if (interviewId) {
      this.activeInterviews.delete(interviewId);
    }
  }

  @SubscribeMessage('start')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { topic: string; subtopic: string; level: string; duration?: number; candidateName?: string },
  ) {
    console.log('Received start event:', data);
    if (!client.data.user) {
      console.log('Unauthorized - no user data');
      return { error: 'Unauthorized' };
    }

    const interviewId = crypto.randomUUID();

    this.activeInterviews.set(interviewId, {
      socketId: client.id,
      userId: client.data.user.id,
      audioChunks: [],
    });

    try {
      console.log('[InterviewGateway] Starting interview:', { interviewId, data });
      const startTime = Date.now();
      
      const { firstMessage, candidateName, interviewer } = await this.interviewService.startInterview(
        interviewId,
        client.data.user.id,
        data.topic,
        data.subtopic,
        data.level,
        data.duration || 30,
        data.candidateName,
      );

      console.log('[InterviewGateway] AI response received:', { 
        interviewId, 
        responseLength: firstMessage.length,
        duration: `${Date.now() - startTime}ms` 
      });

      client.emit('interview:started', { interviewId, candidateName, interviewerName: interviewer.name, interviewerGender: interviewer.gender });
      client.emit('ai:text', { text: firstMessage, candidateName, interviewerName: interviewer.name, interviewerGender: interviewer.gender });
      client.emit('ai:speaking', true);

      return { interviewId, candidateName, interviewerName: interviewer.name, interviewerGender: interviewer.gender };
    } catch (error) {
      console.error('Error starting interview:', error);
      this.activeInterviews.delete(interviewId);
      return { error: 'Failed to start interview' };
    }
  }

  @SubscribeMessage('user:text')
  async handleUserMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: string; text: string },
  ) {
    const interview = this.activeInterviews.get(data.interviewId);
    if (!interview || interview.socketId !== client.id) {
      return { error: 'Interview not found or unauthorized' };
    }

    client.emit('user:speaking', false);
    client.emit('ai:speaking', true);

    try {
      const response = await this.interviewService.processUserMessage(
        data.interviewId,
        data.text,
      );

      client.emit('ai:text', { text: response });
      client.emit('ai:speaking', false);

      return { success: true };
    } catch (error) {
      console.error('Error processing message:', error);
      client.emit('ai:speaking', false);
      return { error: 'Failed to process message' };
    }
  }

  @SubscribeMessage('end')
  async handleEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: string },
  ) {
    const interview = [...this.activeInterviews.entries()].find(([, i]) => i.socketId === client.id);
    if (interview) {
      const [interviewId] = interview;
      const interviewData = this.activeInterviews.get(interviewId);
      try {
        await this.interviewService.endInterview(interviewId);
        this.activeInterviews.delete(interviewId);
        client.emit('interview:ended');
        return { success: true };
      } catch (error) {
        console.error('Error ending interview:', error);
        return { error: 'Failed to end interview' };
      }
    }
    return { error: 'Interview not found or unauthorized' };
  }

  @SubscribeMessage('audio:chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: string; audio: any },
  ) {
    const interviewData = this.activeInterviews.get(data.interviewId);
    if (!interviewData) {
      return { error: 'No active interview' };
    }

    if (interviewData.socketId !== client.id) {
      return { error: 'Socket mismatch' };
    }
    
    let audioBuffer: Buffer;
    
    if (data.audio instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(data.audio);
    } else if (data.audio instanceof Buffer) {
      audioBuffer = data.audio;
    } else if (typeof data.audio === 'object' && data.audio.data) {
      audioBuffer = Buffer.from(data.audio.data);
    } else if (typeof data.audio === 'string') {
      audioBuffer = Buffer.from(data.audio, 'base64');
    } else {
      return { error: 'Unknown audio format' };
    }

    interviewData.audioChunks.push(audioBuffer);

    return { received: true, chunks: interviewData.audioChunks.length };
  }

  @SubscribeMessage('audio:transcribe')
  async handleAudioTranscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { interviewId: string },
  ) {
    const interviewData = this.activeInterviews.get(data.interviewId);
    if (!interviewData) {
      return { error: 'No active interview' };
    }

    if (interviewData.socketId !== client.id) {
      return { error: 'Socket mismatch' };
    }

    const interviewId = data.interviewId;
    
    if (interviewData.audioChunks.length === 0) {
      return { text: '' };
    }

    try {
      const combinedAudio = Buffer.concat(interviewData.audioChunks);
      const text = await this.interviewService.transcribeAudio(combinedAudio);
      
      interviewData.audioChunks = [];
      
      client.emit('stt:result', { text });

      return { text };
    } catch (error) {
      console.error('Transcription error:', error);
      return { error: 'Transcription failed' };
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { timestamp: Date.now() };
  }
}
