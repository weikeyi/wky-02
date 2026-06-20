import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRoles } from '../middleware/auth';
import { verifyAssignmentAccess, getCourseAccess } from '../middleware/courseAccess';

const router = Router();

router.use(authMiddleware);

router.get('/my', async (req, res) => {
  try {
    const appellantId = req.user!.userId;

    const appeals = await prisma.appeal.findMany({
      where: { appellantId },
      include: {
        assignment: { select: { id: true, title: true } },
        submission: {
          select: {
            id: true,
            finalScore: true,
            rawScore: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(appeals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取申诉列表失败' });
  }
});

router.get('/assignment/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(assignmentId, userId);
    if (!access || !access.isStaff) {
      return res.status(403).json({ error: '无权访问' });
    }

    const appeals = await prisma.appeal.findMany({
      where: { assignmentId },
      include: {
        appellant: { select: { id: true, name: true, studentId: true, email: true } },
        submission: {
          select: {
            id: true,
            finalScore: true,
            rawScore: true,
            content: true,
            attachmentUrl: true,
            reviews: {
              where: { status: 'COMPLETED' },
              include: {
                reviewer: { select: { id: true, name: true } },
                criterionScores: true,
              },
            },
          },
        },
        taReviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(appeals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取申诉列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const appeal = await prisma.appeal.findUnique({
      where: { id },
      include: {
        appellant: { select: { id: true, name: true, studentId: true, email: true } },
        assignment: {
          include: {
            rubric: { orderBy: { order: 'asc' } },
          },
        },
        submission: {
          include: {
            student: { select: { id: true, name: true, studentId: true } },
            reviews: {
              where: { status: 'COMPLETED' },
              include: {
                reviewer: { select: { id: true, name: true } },
                criterionScores: true,
              },
            },
          },
        },
        taReviewer: { select: { id: true, name: true } },
      },
    });

    if (!appeal) {
      return res.status(404).json({ error: '申诉不存在' });
    }

    const { access } = await verifyAssignmentAccess(appeal.assignmentId, userId);

    const isOwner = appeal.appellantId === userId;
    const isCourseStaff = access?.isStaff || false;

    if (!isOwner && !isCourseStaff) {
      return res.status(403).json({ error: '无权访问' });
    }

    const result: any = { ...appeal };
    if (appeal.assignment.anonymousReview && !isCourseStaff && !isOwner) {
      result.submission.reviews = appeal.submission.reviews.map((r: any) => ({
        ...r,
        reviewer: { id: r.reviewer.id, name: '匿名评审' },
      }));
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取申诉详情失败' });
  }
});

router.post('/submission/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const appellantId = req.user!.userId;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: '申诉理由不能为空' });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: { id: true, title: true, status: true, courseId: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    const { access } = await verifyAssignmentAccess(submission.assignmentId, appellantId);
    if (!access) {
      return res.status(403).json({ error: '无权访问此作业' });
    }

    if (submission.studentId !== appellantId) {
      return res.status(403).json({ error: '只能对自己的作业发起申诉' });
    }

    if (submission.finalScore === null) {
      return res.status(400).json({ error: '成绩尚未公布，无法申诉' });
    }

    if (submission.isLocked) {
      return res.status(400).json({ error: '成绩已锁定，无法申诉' });
    }

    const existingAppeal = await prisma.appeal.findFirst({
      where: {
        submissionId,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
    });

    if (existingAppeal) {
      return res.status(400).json({ error: '已有待处理的申诉' });
    }

    const appeal = await prisma.appeal.create({
      data: {
        submissionId,
        assignmentId: submission.assignmentId,
        appellantId,
        reason: reason.trim(),
        status: 'PENDING',
      },
      include: {
        assignment: { select: { id: true, title: true } },
        submission: { select: { id: true, finalScore: true } },
      },
    });

    res.status(201).json(appeal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '发起申诉失败' });
  }
});

router.put('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const taReviewerId = req.user!.userId;
    const { status } = req.body;

    const appeal = await prisma.appeal.findUnique({
      where: { id },
    });

    if (!appeal) {
      return res.status(404).json({ error: '申诉不存在' });
    }

    const { access } = await verifyAssignmentAccess(appeal.assignmentId, taReviewerId);
    if (!access || !access.isStaff) {
      return res.status(403).json({ error: '无权处理此申诉' });
    }

    if (appeal.status === 'RESOLVED' || appeal.status === 'REJECTED') {
      return res.status(400).json({ error: '申诉已处理' });
    }

    const updated = await prisma.appeal.update({
      where: { id },
      data: {
        status: status || 'REVIEWING',
        taReviewerId,
      },
      include: {
        taReviewer: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新申诉状态失败' });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const taReviewerId = req.user!.userId;
    const { taScore, taComment, status } = req.body;

    const appeal = await prisma.appeal.findUnique({
      where: { id },
      include: {
        submission: true,
      },
    });

    if (!appeal) {
      return res.status(404).json({ error: '申诉不存在' });
    }

    const { access } = await verifyAssignmentAccess(appeal.assignmentId, taReviewerId);
    if (!access || !access.isStaff) {
      return res.status(403).json({ error: '无权处理此申诉' });
    }

    if (appeal.status === 'RESOLVED' || appeal.status === 'REJECTED') {
      return res.status(400).json({ error: '申诉已处理' });
    }

    if (appeal.submission.isLocked) {
      return res.status(400).json({ error: '成绩已锁定，无法处理' });
    }

    const finalStatus = status || 'RESOLVED';

    if (finalStatus === 'RESOLVED' && (taScore === undefined || taScore === null)) {
      return res.status(400).json({ error: '请提供复核分数' });
    }

    const finalScore = finalStatus === 'RESOLVED' && taScore !== undefined
      ? taScore
      : appeal.submission.finalScore;

    const updated = await prisma.appeal.update({
      where: { id },
      data: {
        status: finalStatus,
        taReviewerId,
        taScore: taScore !== undefined ? taScore : null,
        taComment: taComment || null,
        finalScore,
        reviewedAt: new Date(),
      },
    });

    if (finalStatus === 'RESOLVED' && taScore !== undefined) {
      await prisma.submission.update({
        where: { id: appeal.submissionId },
        data: {
          finalScore: taScore,
          isLocked: true,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '处理申诉失败' });
  }
});

export default router;
