import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { InterviewModule } from './interview/interview.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionsModule } from './questions/questions.module';
import { StorageModule } from './storage/storage.module';
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
    StorageModule,
    TopicsModule,
    AuthModule,
    InterviewModule,
    ProfileModule,
    QuestionsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
