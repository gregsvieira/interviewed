import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  async getProfile(@Request() req) {
    return this.profileService.getProfile(req.user.id);
  }

  @Patch()
  async updateProfile(
    @Request() req,
    @Body() body: { improvementTopics?: string[] },
  ) {
    return this.profileService.updateProfile(req.user.id, body.improvementTopics);
  }
}
