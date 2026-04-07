import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { questions } from '../db/schema';


@Injectable()
export class QuestionsService {
    
  async findByTopicSubtopicLevel(
    topicId: string,
    subtopicId: string,
    level: string,
  ) {
    return db.select()
      .from(questions)
      .where(
        and(
          eq(questions.topicId, topicId),
          eq(questions.subtopicId, subtopicId),
          eq(questions.level, level),
        )
      );
  }


  async findSimilar(embedding: number[], limit = 3) {
    return db.select()
      .from(questions)
      .orderBy(sql`${questions.embedding} <=> ${embedding}::vector`)
      .limit(limit);
  }


  async create(data: {
    topicId: string;
    subtopicId: string;
    level: string;
    question: string;
    followUps?: string[];
    tags?: string[];
    embedding?: number[];
  }) {
    return db.insert(questions).values(data).returning();
  }
}