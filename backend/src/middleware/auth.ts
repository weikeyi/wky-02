import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export type UserRole = 'STUDENT' | 'TEACHER' | 'TA';

export const UserRoleValues: Record<UserRole, UserRole> = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  TA: 'TA',
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthPayload {
  userId: string;
  username: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, name: true, email: true, studentId: true }
  });

  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }

  req.user = {
    userId: user.id,
    username: user.username,
    role: user.role as UserRole,
  };

  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}
