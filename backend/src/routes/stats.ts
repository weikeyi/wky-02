import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware } from '../middleware/auth';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { getCourseAccess, verifyAssignmentAccess } from '../middleware/courseAccess';

const router = Router();

router.use(authMiddleware);

router.get('/assignment/:assignmentId/dashboard', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(assignmentId, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isStaff) {
      return res.status(403).json({ error: '权限不足' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: { where: { role: 'STUDENT' } } } },
          },
        },
        rubric: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const totalStudents = assignment.course._count.members;

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      select: {
        id: true,
        status: true,
        finalScore: true,
        rawScore: true,
        lateMinutes: true,
        isLocked: true,
        studentId: true,
      },
    });

    const submittedCount = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'LATE').length;
    const lateCount = submissions.filter(s => s.status === 'LATE').length;
    const notSubmittedCount = totalStudents - submittedCount;

    const gradedCount = submissions.filter(s => s.finalScore !== null).length;

    const scores = submissions
      .filter(s => s.finalScore !== null)
      .map(s => s.finalScore as number);

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    const scoreDistribution = {
      '90-100': scores.filter(s => s >= 90).length,
      '80-89': scores.filter(s => s >= 80 && s < 90).length,
      '70-79': scores.filter(s => s >= 70 && s < 80).length,
      '60-69': scores.filter(s => s >= 60 && s < 70).length,
      '0-59': scores.filter(s => s < 60).length,
    };

    const allReviews = await prisma.review.findMany({
      where: {
        submission: { assignmentId },
      },
    });

    const totalReviewsAssigned = allReviews.length;
    const completedReviews = allReviews.filter(r => r.status === 'COMPLETED').length;
    const pendingReviews = totalReviewsAssigned - completedReviews;

    const appeals = await prisma.appeal.findMany({
      where: { assignmentId },
      select: { id: true, status: true },
    });

    const appealStats = {
      total: appeals.length,
      pending: appeals.filter(a => a.status === 'PENDING').length,
      reviewing: appeals.filter(a => a.status === 'REVIEWING').length,
      resolved: appeals.filter(a => a.status === 'RESOLVED').length,
      rejected: appeals.filter(a => a.status === 'REJECTED').length,
    };

    res.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        submissionDeadline: assignment.submissionDeadline,
        reviewDeadline: assignment.reviewDeadline,
        maxScore: assignment.maxScore,
      },
      submissions: {
        totalStudents,
        submitted: submittedCount,
        late: lateCount,
        notSubmitted: notSubmittedCount,
        graded: gradedCount,
      },
      scores: {
        average: Math.round(avgScore * 100) / 100,
        max: maxScore,
        min: minScore,
        distribution: scoreDistribution,
      },
      reviews: {
        totalAssigned: totalReviewsAssigned,
        completed: completedReviews,
        pending: pendingReviews,
        completionRate: totalReviewsAssigned > 0
          ? Math.round((completedReviews / totalReviewsAssigned) * 100)
          : 0,
      },
      appeals: appealStats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/course/:courseId/stats', async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.userId;

    const access = await getCourseAccess(courseId, userId);
    if (!access) {
      return res.status(404).json({ error: '课程不存在或无权访问' });
    }
    if (!access.isStaff) {
      return res.status(403).json({ error: '权限不足' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        _count: {
          select: {
            assignments: true,
            members: { where: { role: 'STUDENT' } },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      include: {
        _count: {
          select: { submissions: true, appeals: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentScores = await prisma.submission.findMany({
      where: {
        assignment: { courseId },
        finalScore: { not: null },
      },
      select: {
        studentId: true,
        finalScore: true,
        assignmentId: true,
      },
    });

    const studentScoreMap = new Map<string, { total: number; count: number; assignments: Record<string, number> }>();

    for (const score of studentScores) {
      if (!studentScoreMap.has(score.studentId)) {
        studentScoreMap.set(score.studentId, { total: 0, count: 0, assignments: {} });
      }
      const data = studentScoreMap.get(score.studentId)!;
      data.total += score.finalScore || 0;
      data.count++;
      data.assignments[score.assignmentId] = score.finalScore || 0;
    }

    const overallStats = {
      totalAssignments: course._count.assignments,
      totalStudents: course._count.members,
    };

    res.json({
      course,
      overall: overallStats,
      assignments,
      studentScores: Object.fromEntries(studentScoreMap),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取课程统计失败' });
  }
});

router.get('/assignment/:assignmentId/export', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user!.userId;

    const { access } = await verifyAssignmentAccess(assignmentId, userId);
    if (!access) {
      return res.status(404).json({ error: '作业不存在或无权访问' });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: '权限不足' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: true,
        rubric: { orderBy: { order: 'asc' } },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: '作业不存在' });
    }

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: { id: true, name: true, studentId: true, email: true },
        },
        reviews: {
          where: { status: 'COMPLETED' },
          include: {
            reviewer: { select: { id: true, name: true, studentId: true } },
            criterionScores: true,
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const submissionsWithAppeal = submissions.map((s: any) => ({
      ...s,
      appeal: s.appeals[0] || null,
    }));

    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const csvPath = path.join(exportDir, `grades_${assignmentId}.csv`);

    const rubricHeaders = assignment.rubric.map(r => ({ id: `rubric_${r.id}`, title: r.name }));

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'studentId', title: '学号' },
        { id: 'name', title: '姓名' },
        { id: 'email', title: '邮箱' },
        { id: 'status', title: '提交状态' },
        { id: 'submittedAt', title: '提交时间' },
        { id: 'lateMinutes', title: '迟交分钟数' },
        { id: 'rawScore', title: '原始分' },
        { id: 'finalScore', title: '最终分' },
        { id: 'reviewCount', title: '互评数' },
        { id: 'appealStatus', title: '申诉状态' },
        { id: 'taScore', title: '复核分' },
        { id: 'isLocked', title: '是否锁定' },
      ],
    });

    const records = submissionsWithAppeal.map((s: any) => ({
      studentId: s.student.studentId || '',
      name: s.student.name,
      email: s.student.email,
      status: s.status,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : '',
      lateMinutes: s.lateMinutes,
      rawScore: s.rawScore || '',
      finalScore: s.finalScore || '',
      reviewCount: s.reviews.length,
      appealStatus: s.appeal?.status || '无',
      taScore: s.appeal?.taScore || '',
      isLocked: s.isLocked ? '是' : '否',
    }));

    await csvWriter.writeRecords(records);

    res.download(csvPath, `grades_${assignment.title}.csv`, (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: '导出失败' });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '导出成绩失败' });
  }
});

export default router;
