import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('interview')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private interviewService: InterviewService) {}

  @Get('history')
  async getHistory(@Request() req) {
    return this.interviewService.getInterviewHistory(req.user.id);
  }

  @Get('stats')
  async getStats(@Request() req) {
    return this.interviewService.getInterviewStats(req.user.id);
  }

  @Get(':id')
  async getInterview(@Param('id') id: string) {
    return this.interviewService.getInterview(id);
  }
}
