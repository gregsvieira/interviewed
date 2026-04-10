import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';

const DEFAULT_TOPICS = [
  'softskills',
  'frontend',
  'backend',
  'fullstack',
  'devops',
  'database',
];

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    improvementTopics: string[];
    lastInterviewDate: Date | null;
    avatar: string | null;
    createdAt: Date | null;
  };
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string): Promise<AuthResult> {
    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersRepository.create({
      email,
      passwordHash,
      name,
      improvementTopics: [...DEFAULT_TOPICS],
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        improvementTopics: user.improvementTopics || [],
        lastInterviewDate: user.lastInterviewDate,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        improvementTopics: user.improvementTopics || [],
        lastInterviewDate: user.lastInterviewDate,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async validateUser(payload: { sub: string; email: string }): Promise<{
    id: string;
    email: string;
    name: string;
    improvementTopics: string[];
    lastInterviewDate: Date | null;
    avatar: string | null;
    createdAt: Date | null;
  } | null> {
    const user = await this.usersRepository.findById(payload.sub);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      improvementTopics: user.improvementTopics || [],
      lastInterviewDate: user.lastInterviewDate,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }

  async getUserById(id: string): Promise<{
    id: string;
    email: string;
    name: string;
    improvementTopics: string[];
    lastInterviewDate: Date | null;
    avatar: string | null;
    createdAt: Date | null;
  } | null> {
    const user = await this.usersRepository.findById(id);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      improvementTopics: user.improvementTopics || [],
      lastInterviewDate: user.lastInterviewDate,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }

  async updateUser(id: string, updates: Partial<{
    improvementTopics: string[];
    lastInterviewDate: string;
    avatar: string;
  }>): Promise<{
    id: string;
    email: string;
    name: string;
    improvementTopics: string[];
    lastInterviewDate: Date | null;
    avatar: string | null;
    createdAt: Date | null;
  } | null> {
    const updateData: Partial<{
      name: string;
      improvementTopics: string[];
      lastInterviewDate: Date;
      avatar: string;
    }> = {};

    if (updates.improvementTopics !== undefined) {
      updateData.improvementTopics = updates.improvementTopics;
    }
    if (updates.lastInterviewDate !== undefined) {
      updateData.lastInterviewDate = new Date(updates.lastInterviewDate);
    }
    if (updates.avatar !== undefined) {
      updateData.avatar = updates.avatar;
    }

    const user = await this.usersRepository.update(id, updateData);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      improvementTopics: user.improvementTopics || [],
      lastInterviewDate: user.lastInterviewDate,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };
  }
}
