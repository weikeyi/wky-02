import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRoles } from '../middleware/auth';
import { getAssignmentStatus, calculateLateMinutes } from '../services/assignmentStatus';
import { calculateFinalScore } from '../services/scoring';
import { verifyAssignmentAccess } from '../middleware/courseAccess';

const router = Router();

router.use(authMiddleware);

router.get('/assignment/:assignmentId/my', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user!.userId;

    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
      include: {
        reviews: {
          where: { status: 'COMPLETED' },
          include: {
            criterionScores: true,
            reviewer: {
              select: { id: true, name: true },
            },
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!submission) {
      return res.json(null);
    }

    const result: any = { ...submission, appeal: submission.appeals[0] || null };
    delete result.appeals;

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取提交失败' });
  }
});

router.get('/assignment/:assignmentId/all', requireRoles('TEACHER', 'TA'), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: { id: true, name: true, studentId: true, email: true },
        },
        reviews: {
          where: { status: 'COMPLETED' },
          include: {
            reviewer: { select: { id: true, name: true } },
            criterionScores: true,
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = submissions.map((s: any) => ({
      ...s,
      appeal: s.appeals[0] || null,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取提交列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        assignment: {
          include: {
            course: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        student: {
          select: { id: true, name: true, studentId: true, email: true },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true } },
            criterionScores: true,
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    const submissionAny = submission as any;
    const isOwner = submission.studentId === userId;
    const isCourseStaff = submissionAny.assignment?.course?.members?.length > 0 &&
      (userRole === 'TEACHER' || userRole === 'TA');

    if (!isOwner && !isCourseStaff) {
      return res.status(403).json({ error: '无权访问' });
    }

    const result: any = { ...submissionAny, appeal: submissionAny.appeals[0] || null };
    delete result.appeals;

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取提交详情失败' });
  }
});

router.post('/assignment/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user!.userId;
    const { content, attachmentUrl } = req.body;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const { access } = await verifyAssignmentAccess(assignmentId, studentId);
    if (!access || !access.isStudent) {
      return res.status(403).json({ error: '无权提交此作业' });
    }

    const currentStatus = getAssignmentStatus(assignment);
    if (currentStatus !== 'SUBMISSION' && currentStatus !== 'REOPENED') {
      return res.status(400).json({ error: '当前阶段不允许提交' });
    }

    if (!content && !attachmentUrl) {
      return res.status(400).json({ error: '提交内容不能为空' });
    }

    const now = new Date();
    const isLate = now > assignment.submissionDeadline;

    const existing = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
    });

    if (existing && existing.isLocked) {
      return res.status(400).json({ error: '成绩已锁定，无法修改' });
    }

    const lateMinutes = isLate
      ? Math.ceil((now.getTime() - assignment.submissionDeadline.getTime()) / (1000 * 60))
      : 0;

    const status = isLate ? 'LATE' : 'SUBMITTED';

    let submission;

    if (existing) {
      submission = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          content: content || null,
          attachmentUrl: attachmentUrl || null,
          status,
          submittedAt: now,
          lateMinutes,
        },
      });
    } else {
      submission = await prisma.submission.create({
        data: {
          assignmentId,
          studentId,
          content: content || null,
          attachmentUrl: attachmentUrl || null,
          status,
          submittedAt: now,
          lateMinutes,
        },
      });
    }

    res.json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '提交失败' });
  }
});

router.post('/:id/calculate-score', requireRoles('TEACHER', 'TA'), async (req, res) => {
  try {
    const { id } = req.params;

    const score = await calculateFinalScore(id);

    res.json({ finalScore: score });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '计算分数失败' });
  }
});

router.post('/assignment/:assignmentId/calculate-all', requireRoles('TEACHER'), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const submissions = await prisma.submission.findMany({
      where: {
        assignmentId,
        status: { in: ['SUBMITTED', 'LATE'] },
      },
    });

    const results = [];
    for (const submission of submissions) {
      const score = await calculateFinalScore(submission.id);
      results.push({ submissionId: submission.id, finalScore: score });
    }

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'GRADING' },
    });

    res.json({ results, count: results.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '批量计算分数失败' });
  }
});

router.post('/:id/lock', requireRoles('TEACHER'), async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await prisma.submission.update({
      where: { id },
      data: { isLocked: true },
    });

    res.json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '锁定成绩失败' });
  }
});

export default router;
