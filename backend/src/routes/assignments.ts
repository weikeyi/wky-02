import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware } from '../middleware/auth';
import { allocateReviews } from '../services/reviewAllocation';
import { getAssignmentStatus } from '../services/assignmentStatus';
import { getCourseAccess, verifyAssignmentAccess, requireCourseRole } from '../middleware/courseAccess';

const router = Router();

router.use(authMiddleware);

router.get('/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.userId;

    const membership = await prisma.courseMember.findFirst({
      where: { courseId, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: '无权访问' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            submissions: true,
            appeals: true,
          },
        },
      },
    });

    const assignmentsWithStatus = assignments.map((a) => ({
      ...a,
      currentStatus: getAssignmentStatus(a),
    }));

    res.json(assignmentsWithStatus);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取作业列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        rubric: { orderBy: { order: 'asc' } },
        course: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const isMember = assignment.course.members.length > 0;
    if (!isMember) {
      return res.status(403).json({ error: '无权访问' });
    }

    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: id,
          studentId: userId,
        },
      },
    });

    const reviewCount = await prisma.review.count({
      where: {
        reviewerId: userId,
        submission: { assignmentId: id },
      },
    });

    res.json({
      ...assignment,
      currentStatus: getAssignmentStatus(assignment),
      userSubmission: submission,
      userReviewCount: reviewCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取作业详情失败' });
  }
});

router.post('/', requireCourseRole('TEACHER'), async (req, res) => {
  try {
    const {
      courseId,
      title,
      description,
      submissionDeadline,
      reviewDeadline,
      reviewsPerSubmission,
      anonymousReview,
      dropHighestLowest,
      lateDeductionType,
      lateDeductionValue,
      lateDeductionMax,
      incompleteReviewPenalty,
      maxScore,
      rubric,
    } = req.body;

    if (!courseId || !title || !submissionDeadline || !reviewDeadline) {
      return res.status(400).json({ error: '请填写必填项' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description: description || null,
        submissionDeadline: new Date(submissionDeadline),
        reviewDeadline: new Date(reviewDeadline),
        reviewsPerSubmission: reviewsPerSubmission || 3,
        anonymousReview: anonymousReview !== false,
        dropHighestLowest: dropHighestLowest !== false,
        lateDeductionType: lateDeductionType || 'NONE',
        lateDeductionValue: lateDeductionValue || 0,
        lateDeductionMax: lateDeductionMax || 100,
        incompleteReviewPenalty: incompleteReviewPenalty || 5,
        maxScore: maxScore || 100,
        rubric: rubric && rubric.length > 0
          ? {
              create: rubric.map((item: any, index: number) => ({
                name: item.name,
                description: item.description || null,
                maxScore: item.maxScore,
                weight: item.weight || 1,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        rubric: { orderBy: { order: 'asc' } },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建作业失败' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const {
      title,
      description,
      submissionDeadline,
      reviewDeadline,
      reviewsPerSubmission,
      anonymousReview,
      dropHighestLowest,
      lateDeductionType,
      lateDeductionValue,
      lateDeductionMax,
      incompleteReviewPenalty,
      maxScore,
      status,
      rubric,
    } = req.body;

    const { access } = await verifyAssignmentAccess(id, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: '无权修改' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (submissionDeadline) updateData.submissionDeadline = new Date(submissionDeadline);
    if (reviewDeadline) updateData.reviewDeadline = new Date(reviewDeadline);
    if (reviewsPerSubmission !== undefined) updateData.reviewsPerSubmission = reviewsPerSubmission;
    if (anonymousReview !== undefined) updateData.anonymousReview = anonymousReview;
    if (dropHighestLowest !== undefined) updateData.dropHighestLowest = dropHighestLowest;
    if (lateDeductionType !== undefined) updateData.lateDeductionType = lateDeductionType;
    if (lateDeductionValue !== undefined) updateData.lateDeductionValue = lateDeductionValue;
    if (lateDeductionMax !== undefined) updateData.lateDeductionMax = lateDeductionMax;
    if (incompleteReviewPenalty !== undefined) updateData.incompleteReviewPenalty = incompleteReviewPenalty;
    if (maxScore !== undefined) updateData.maxScore = maxScore;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: {
        rubric: { orderBy: { order: 'asc' } },
      },
    });

    if (rubric && rubric.length > 0) {
      await prisma.rubricCriterion.deleteMany({ where: { assignmentId: id } });
      await prisma.rubricCriterion.createMany({
        data: rubric.map((item: any, index: number) => ({
          assignmentId: id,
          name: item.name,
          description: item.description || null,
          maxScore: item.maxScore,
          weight: item.weight || 1,
          order: index,
        })),
      });
    }

    const finalAssignment = await prisma.assignment.findUnique({
      where: { id },
      include: { rubric: { orderBy: { order: 'asc' } } },
    });

    res.json(finalAssignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新作业失败' });
  }
});

router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(id, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: '无权发布' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { rubric: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    if (assignment.rubric.length === 0) {
      return res.status(400).json({ error: '请先配置评分标准' });
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: { status: 'SUBMISSION' },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '发布作业失败' });
  }
});

router.post('/:id/allocate-reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(id, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isStaff) {
      return res.status(403).json({ error: '无权分配互评' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    await allocateReviews(id);

    res.json({ message: '互评分配完成' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '分配互评失败' });
  }
});

router.post('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { newSubmissionDeadline, newReviewDeadline } = req.body;

    const { access } = await verifyAssignmentAccess(id, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: '无权操作' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const updateData: any = { status: 'REOPENED' };
    if (newSubmissionDeadline) updateData.submissionDeadline = new Date(newSubmissionDeadline);
    if (newReviewDeadline) updateData.reviewDeadline = new Date(newReviewDeadline);

    const updated = await prisma.assignment.update({
      where: { id },
      data: updateData,
    });

    await prisma.submission.updateMany({
      where: { assignmentId: id, isLocked: false },
      data: { isLocked: false },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '重新开放作业失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(id, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: '无权删除' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    await prisma.assignment.delete({ where: { id } });

    res.json({ message: '作业已删除' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除作业失败' });
  }
});

export default router;
