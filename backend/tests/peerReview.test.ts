import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { allocateReviews } from '../src/services/reviewAllocation';
import { calculateSubmissionScore, calculateFinalScore } from '../src/services/scoring';

const prisma = new PrismaClient();

describe('Review Allocation', () => {
  let teacher: any;
  let students: any[];
  let course: any;
  let assignment: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_test',
        email: 'teacher@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    students = [];
    for (let i = 0; i < 10; i++) {
      const student = await prisma.user.create({
        data: {
          username: `student_test_${i}`,
          email: `student${i}@test.com`,
          password: hashedPassword,
          name: `Student ${i}`,
          role: 'STUDENT',
          studentId: `TEST00${i}`,
        },
      });
      students.push(student);
    }

    course = await prisma.course.create({
      data: {
        name: 'Test Course',
        code: 'TEST101',
        teacherId: teacher.id,
      },
    });

    for (const student of students) {
      await prisma.courseMember.create({
        data: {
          courseId: course.id,
          userId: student.id,
          role: 'STUDENT',
        },
      });
    }

    const group1 = await prisma.group.create({
      data: { courseId: course.id, name: 'Group 1' },
    });
    const group2 = await prisma.group.create({
      data: { courseId: course.id, name: 'Group 2' },
    });

    for (let i = 0; i < 5; i++) {
      await prisma.groupMember.create({
        data: { groupId: group1.id, userId: students[i].id },
      });
    }
    for (let i = 5; i < 10; i++) {
      await prisma.groupMember.create({
        data: { groupId: group2.id, userId: students[i].id },
      });
    }

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Test Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        reviewsPerSubmission: 3,
        anonymousReview: true,
        dropHighestLowest: true,
        lateDeductionType: 'NONE',
        incompleteReviewPenalty: 5,
        maxScore: 100,
      },
    });

    for (const student of students) {
      await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: student.id,
          content: 'Test submission content',
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should allocate reviews correctly', async () => {
    await allocateReviews(assignment.id);

    const reviews = await prisma.review.findMany();
    expect(reviews.length).toBe(30);

    const submissions = await prisma.submission.findMany({
      where: { assignmentId: assignment.id },
      include: { _count: { select: { reviews: true } } },
    });

    for (const submission of submissions) {
      expect(submission._count.reviews).toBe(3);
    }

    const reviewerCounts: Record<string, number> = {};
    for (const review of reviews) {
      reviewerCounts[review.reviewerId] = (reviewerCounts[review.reviewerId] || 0) + 1;
    }

    const counts = Object.values(reviewerCounts);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    expect(maxCount - minCount).toBeLessThanOrEqual(1);
  });

  test('should not assign review to self', async () => {
    const reviews = await prisma.review.findMany({
      include: { submission: true },
    });

    for (const review of reviews) {
      expect(review.reviewerId).not.toBe(review.submission.studentId);
    }
  });

  test('should not assign same group members', async () => {
    const reviews = await prisma.review.findMany({
      include: { submission: true },
    });

    const groupMembers = await prisma.groupMember.findMany({
      where: { group: { courseId: course.id } },
    });

    const studentGroupMap = new Map<string, string>();
    for (const gm of groupMembers) {
      studentGroupMap.set(gm.userId, gm.groupId);
    }

    for (const review of reviews) {
      const reviewerGroup = studentGroupMap.get(review.reviewerId);
      const submitterGroup = studentGroupMap.get(review.submission.studentId);
      if (reviewerGroup && submitterGroup) {
        expect(reviewerGroup).not.toBe(submitterGroup);
      }
    }
  });
});

describe('Score Calculation', () => {
  let teacher: any;
  let student1: any;
  let student2: any;
  let student3: any;
  let student4: any;
  let course: any;
  let assignment: any;
  let submission: any;
  let rubric: any[];

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_score',
        email: 'teacher_score@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    const students = [];
    for (let i = 1; i <= 5; i++) {
      const s = await prisma.user.create({
        data: {
          username: `student_score_${i}`,
          email: `student_score_${i}@test.com`,
          password: hashedPassword,
          name: `Student Score ${i}`,
          role: 'STUDENT',
        },
      });
      students.push(s);
    }
    [student1, student2, student3, student4] = students;

    course = await prisma.course.create({
      data: {
        name: 'Score Test Course',
        code: 'SCORE101',
        teacherId: teacher.id,
      },
    });

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Score Test Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        reviewsPerSubmission: 3,
        dropHighestLowest: true,
        lateDeductionType: 'NONE',
        maxScore: 100,
      },
    });

    rubric = [];
    const criteria = [
      { name: 'Criterion 1', maxScore: 30, order: 0 },
      { name: 'Criterion 2', maxScore: 30, order: 1 },
      { name: 'Criterion 3', maxScore: 40, order: 2 },
    ];

    for (const c of criteria) {
      const criterion = await prisma.rubricCriterion.create({
        data: {
          assignmentId: assignment.id,
          name: c.name,
          maxScore: c.maxScore,
          order: c.order,
        },
      });
      rubric.push(criterion);
    }

    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student1.id,
        content: 'Test submission',
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    const reviewScores = [
      { student: student2, scores: [25, 25, 35] },
      { student: student3, scores: [28, 27, 38] },
      { student: student4, scores: [15, 15, 20] },
    ];

    for (const rs of reviewScores) {
      const review = await prisma.review.create({
        data: {
          submissionId: submission.id,
          reviewerId: rs.student.id,
          status: 'COMPLETED',
          overallScore: rs.scores.reduce((a, b) => a + b, 0),
          completedAt: new Date(),
        },
      });

      for (let i = 0; i < rubric.length; i++) {
        await prisma.reviewCriterionScore.create({
          data: {
            reviewId: review.id,
            criterionId: rubric[i].id,
            score: rs.scores[i],
          },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should calculate average score with drop highest lowest', async () => {
    const score = await calculateSubmissionScore(submission.id, true);
    expect(score).not.toBeNull();

    const allTotals = [85, 93, 50];
    const sorted = [...allTotals].sort((a, b) => a - b);
    const middle = sorted.slice(1, -1);
    const expected = middle.reduce((a, b) => a + b, 0) / middle.length;

    expect(score).toBeCloseTo(expected, 2);
  });

  test('should calculate average score without drop', async () => {
    const score = await calculateSubmissionScore(submission.id, false);
    expect(score).not.toBeNull();

    const expected = (85 + 93 + 50) / 3;
    expect(score).toBeCloseTo(expected, 2);
  });

  test('should calculate final score', async () => {
    const finalScore = await calculateFinalScore(submission.id);
    expect(finalScore).not.toBeNull();
    expect(typeof finalScore).toBe('number');
  });
});

describe('Assignment Status', () => {
  test('should have correct submission status when before deadline', () => {
    const assignment = {
      submissionDeadline: new Date(Date.now() + 86400000),
      reviewDeadline: new Date(Date.now() + 172800000),
      status: 'SUBMISSION' as const,
    };

    const { getAssignmentStatus } = require('../src/services/assignmentStatus');
    const status = getAssignmentStatus(assignment);
    expect(status).toBe('SUBMISSION');
  });

  test('should have correct peer review status', () => {
    const assignment = {
      submissionDeadline: new Date(Date.now() - 86400000),
      reviewDeadline: new Date(Date.now() + 86400000),
      status: 'SUBMISSION' as const,
    };

    const { getAssignmentStatus } = require('../src/services/assignmentStatus');
    const status = getAssignmentStatus(assignment);
    expect(status).toBe('PEER_REVIEW');
  });

  test('should be completed after review deadline', () => {
    const assignment = {
      submissionDeadline: new Date(Date.now() - 172800000),
      reviewDeadline: new Date(Date.now() - 86400000),
      status: 'SUBMISSION' as const,
    };

    const { getAssignmentStatus } = require('../src/services/assignmentStatus');
    const status = getAssignmentStatus(assignment);
    expect(status).toBe('COMPLETED');
  });
});
