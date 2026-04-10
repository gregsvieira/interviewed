import { Module } from '@nestjs/common';
import { InterviewsModule } from '../interviews/interviews.module';
import { QuestionsModule } from '../questions/questions.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [QuestionsModule, InterviewsModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}