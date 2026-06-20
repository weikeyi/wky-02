import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { UserRole } from './auth';

export interface CourseAccessInfo {
  courseId: string;
  userId: string;
  role: UserRole;
  isTeacher: boolean;
  isTA: boolean;
  isStaff: boolean;
  isStudent: boolean;
}

export async function getCourseAccess(
  courseId: string,
  userId: string
): Promise<CourseAccessInfo | null> {
  const membership = await prisma.courseMember.findFirst({
    where: { courseId, userId },
  });

  if (!membership) return null;

  const role = membership.role as UserRole;
  return {
    courseId,
    userId,
    role,
    isTeacher: role === 'TEACHER',
    isTA: role === 'TA',
    isStaff: role === 'TEACHER' || role === 'TA',
    isStudent: role === 'STUDENT',
  };
}

export function requireCourseRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.courseId || req.body.courseId;
      if (!courseId) {
        return res.status(400).json({ error: '缺少课程ID' });
      }

      const userId = req.user!.userId;
      const access = await getCourseAccess(courseId, userId);

      if (!access) {
        return res.status(403).json({ error: '无权访问此课程' });
      }

      if (!roles.includes(access.role)) {
        return res.status(403).json({ error: '权限不足' });
      }

      (req as any).courseAccess = access;
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: '权限检查失败' });
    }
  };
}

export async function verifyAssignmentAccess(
  assignmentId: string,
  userId: string
): Promise<{ access: CourseAccessInfo | null; courseId: string | null }> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { courseId: true },
  });

  if (!assignment) {
    return { access: null, courseId: null };
  }

  const access = await getCourseAccess(assignment.courseId, userId);
  return { access, courseId: assignment.courseId };
}
