import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UserWithoutPassword } from '../auth/entities/user.entity';

@Injectable()
export class ProfileService {
  constructor(private authService: AuthService) {}

  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, improvementTopics?: string[]): Promise<UserWithoutPassword> {
    const user = await this.authService.updateUser(userId, { improvementTopics });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
