import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { InterviewModule } from './interview/interview.module';
import { StorageModule } from './storage/storage.module';
import { TopicsModule } from './topics/topics.module';
import { ProfileModule } from './profile/profile.module';
import { Controller, Get } from '@nestjs/common';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
