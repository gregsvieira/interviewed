export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date | null;
  improvementTopics: string[] | null;
  lastInterviewDate: Date | null;
  avatar: string | null;
}

export type UserWithoutPassword = Omit<User, 'passwordHash'>;
