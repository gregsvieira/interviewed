import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { InterviewsModule } from './interviews/interviews.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionsModule } from './questions/questions.module';
import { TopicsModule } from './topics/topics.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    BootstrapModule,
    TopicsModule,
    AuthModule,
    InterviewsModule,
    ProfileModule,
    QuestionsModule,
    EvaluationsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
