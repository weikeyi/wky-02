import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRoles, UserRole } from '../middleware/auth';
import { validateRubricScores } from '../services/reviewAllocation';
import { calculateFinalScore } from '../services/scoring';

const router = Router();

router.use(authMiddleware);

router.get('/my/assignment/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const reviewerId = req.user!.userId;

    const reviews = await prisma.review.findMany({
      where: {
        reviewerId,
        submission: { assignmentId },
      },
      include: {
        submission: {
          include: {
            student: {
              select: { id: true, name: true, studentId: true },
            },
          },
        },
        criterionScores: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { anonymousReview: true },
    });

    const result = reviews.map((review) => {
      const reviewData: any = { ...review };
      if (assignment?.anonymousReview && review.submission.studentId !== reviewerId) {
        reviewData.submission = {
          ...review.submission,
          student: { id: review.submission.studentId, name: '匿名学生', studentId: null },
        };
      }
      return reviewData;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取互评任务失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            student: { select: { id: true, name: true, studentId: true } },
            assignment: {
              include: {
                rubric: { orderBy: { order: 'asc' } },
                course: true,
              },
            },
          },
        },
        criterionScores: true,
        reviewer: { select: { id: true, name: true } },
      },
    });

    if (!review) {
      return res.status(404).json({ error: '互评不存在' });
    }

    const isReviewer = review.reviewerId === userId;
    const isSubmissionOwner = review.submission.studentId === userId;
    const isCourseStaff = userRole === 'TEACHER' || userRole === 'TA';

    if (!isReviewer && !isSubmissionOwner && !isCourseStaff) {
      return res.status(403).json({ error: '无权访问' });
    }

    const result: any = { ...review };
    if (review.submission.assignment.anonymousReview && !isCourseStaff && !isReviewer) {
      result.reviewer = { id: result.reviewer.id, name: '匿名评审', studentId: null };
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取互评详情失败' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user!.userId;
    const { scores, overallComment, status } = req.body;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            assignment: {
              include: {
                rubric: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: '互评不存在' });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({ error: '无权修改' });
    }

    if (review.status === 'COMPLETED' && status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: '已完成的互评无法修改' });
    }

    const rubric = review.submission.assignment.rubric;
    if (scores && scores.length > 0) {
      if (!validateRubricScores(scores, rubric)) {
        return res.status(400).json({ error: '评分数据无效' });
      }

      await prisma.reviewCriterionScore.deleteMany({
        where: { reviewId: id },
      });

      await prisma.reviewCriterionScore.createMany({
        data: scores.map((s: any) => ({
          reviewId: id,
          criterionId: s.criterionId,
          score: s.score,
          comment: s.comment || null,
        })),
      });
    }

    let overallScore = null;
    if (scores && scores.length > 0) {
      overallScore = scores.reduce((sum: number, s: any) => sum + s.score, 0);
    }

    const newStatus = status || (scores && scores.length > 0 ? 'IN_PROGRESS' : 'ASSIGNED');

    const updated = await prisma.review.update({
      where: { id },
      data: {
        overallScore,
        overallComment: overallComment || null,
        status: newStatus,
        completedAt: newStatus === 'COMPLETED' ? new Date() : null,
      },
      include: {
        criterionScores: true,
      },
    });

    if (newStatus === 'COMPLETED') {
      await calculateFinalScore(review.submissionId);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存互评失败' });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user!.userId;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            assignment: {
              include: { rubric: true },
            },
          },
        },
        criterionScores: true,
      },
    });

    if (!review) {
      return res.status(404).json({ error: '互评不存在' });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({ error: '无权操作' });
    }

    if (review.status === 'COMPLETED') {
      return res.status(400).json({ error: '已提交的互评无法再次提交' });
    }

    const rubricCount = review.submission.assignment.rubric.length;
    const scoredCount = review.criterionScores.length;

    if (scoredCount < rubricCount) {
      return res.status(400).json({ error: '请完成所有评分项' });
    }

    const overallScore = review.criterionScores.reduce((sum, s) => sum + s.score, 0);

    const updated = await prisma.review.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        overallScore,
        completedAt: new Date(),
      },
      include: {
        criterionScores: true,
      },
    });

    await calculateFinalScore(review.submissionId);

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '提交互评失败' });
  }
});

router.get('/submission/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: { anonymousReview: true, courseId: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    const isOwner = submission.studentId === userId;
    const isCourseStaff = userRole === 'TEACHER' || userRole === 'TA';

    if (!isOwner && !isCourseStaff) {
      return res.status(403).json({ error: '无权访问' });
    }

    const reviews = await prisma.review.findMany({
      where: {
        submissionId,
        status: 'COMPLETED',
      },
      include: {
        reviewer: { select: { id: true, name: true } },
        criterionScores: true,
      },
    });

    const result = reviews.map((review) => {
      const r: any = { ...review };
      if (submission.assignment.anonymousReview && !isCourseStaff) {
        r.reviewer = { id: r.reviewer.id, name: '匿名评审' };
      }
      return r;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取互评列表失败' });
  }
});

export default router;
