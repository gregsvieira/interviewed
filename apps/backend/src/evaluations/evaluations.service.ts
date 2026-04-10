import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { evaluations as evaluationsTable } from '../db/schema';
import { OllamaService } from '../interviews/ai/ollama.service';
import { createEvaluationPrompt, EvaluationQA } from '../interviews/ai/prompts/evaluation.prompt';
import { QuestionsService } from '../questions/questions.service';

export interface QuestionEvaluation {
  question: string;
  candidateAnswer: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface EvaluationResult {
  interviewId: string;
  topicId: string;
  subtopicId: string;
  level: string;
  overallScore: number;
  questionEvaluations: QuestionEvaluation[];
  createdAt: Date;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private questionsService: QuestionsService,
    private ollamaService: OllamaService,
  ) {}

  async getEvaluation(interviewId: string): Promise<EvaluationResult | null> {
    const existingEvaluation = await db
      .select()
      .from(evaluationsTable)
      .where(
        sql`${evaluationsTable.interviewId} = ${interviewId}`
      )
      .limit(1);

    if (existingEvaluation.length > 0) {
      const evalData = existingEvaluation[0];
      return {
        interviewId: evalData.interviewId,
        topicId: evalData.topicId,
        subtopicId: evalData.subtopicId,
        level: evalData.level,
        overallScore: evalData.overallScore,
        questionEvaluations: (evalData.questionEvaluations ? JSON.parse(evalData.questionEvaluations) : []) as QuestionEvaluation[],
        createdAt: evalData.createdAt || new Date(),
      };
    }

    return null;
  }

  async evaluateInterview(
    interviewId: string,
    topicId: string,
    subtopicId: string,
    level: string,
    messages: { role: string; text: string }[],
  ): Promise<EvaluationResult> {
    const qaPairs = this.extractQAPairs(messages);

    const questionData = await this.questionsService.findByTopicSubtopicLevel(
      topicId,
      subtopicId,
      level,
    );

    if (!questionData || questionData.length === 0) {
      throw new Error('No question data found for this topic/subtopic/level');
    }

    const questionInfo = questionData[0];

    const questionEvaluations: QuestionEvaluation[] = [];

    for (const qa of qaPairs) {
      if (!qa.answer.trim()) continue;

      const evaluation = await this.evaluateWithLLM(
        qa.question,
        qa.answer,
        questionInfo.expectedAnswer || '',
        questionInfo.criteria || [],
      );

      questionEvaluations.push({
        question: qa.question,
        candidateAnswer: qa.answer,
        score: evaluation.score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      });
    }

    const overallScore = questionEvaluations.length > 0
      ? Math.round(questionEvaluations.reduce((sum, q) => sum + q.score, 0) / questionEvaluations.length)
      : 0;

    await db.insert(evaluationsTable).values({
      interviewId,
      topicId,
      subtopicId,
      level,
      overallScore,
      questionEvaluations: JSON.stringify(questionEvaluations),
    });

    return {
      interviewId,
      topicId,
      subtopicId,
      level,
      overallScore,
      questionEvaluations,
      createdAt: new Date(),
    };
  }

  private extractQAPairs(messages: { role: string; text: string }[]): EvaluationQA[] {
    const pairs: EvaluationQA[] = [];
    let currentQuestion = '';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === 'ai') {
        if (!msg.text.includes('question:') && !msg.text.includes('?')) {
          currentQuestion = msg.text;
        }
      } else if (msg.role === 'user' && currentQuestion) {
        pairs.push({
          question: currentQuestion,
          answer: msg.text,
        });
        currentQuestion = '';
      }
    }

    return pairs;
  }

  private async evaluateWithLLM(
    question: string,
    candidateAnswer: string,
    expectedAnswer: string,
    criteria: string[],
  ): Promise<QuestionEvaluation> {
    const prompt = createEvaluationPrompt(
      question,
      candidateAnswer,
      expectedAnswer,
      criteria,
    );

    try {
      const { response } = await this.ollamaService.generate(prompt);

      const parsed = this.parseLLMResponse(response);

      return {
        question,
        candidateAnswer,
        score: parsed.score,
        feedback: parsed.feedback,
        strengths: parsed.strengths,
        improvements: parsed.improvements,
      };
    } catch (error) {
      console.error('[EvaluationsService] Error evaluating with LLM:', error);
      return {
        question,
        candidateAnswer,
        score: 50,
        feedback: 'Error during evaluation. Please try again.',
        strengths: [],
        improvements: ['Unable to evaluate at this time'],
      };
    }
  }

  private parseLLMResponse(response: string): {
    score: number;
    strengths: string[];
    improvements: string[];
    feedback: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(100, Math.max(0, parsed.score || 50)),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          feedback: parsed.feedback || '',
        };
      }
    } catch (e) {
      console.error('[EvaluationsService] Failed to parse LLM response:', e);
    }

    return {
      score: 50,
      strengths: [],
      improvements: ['Unable to parse evaluation'],
      feedback: response.substring(0, 500),
    };
  }
}