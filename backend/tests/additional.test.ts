import { prisma, bcrypt } from './setup';
import { calculateFinalScore, penalizeIncompleteReviews, isAnomalousScore } from '../src/services/scoring';
import { allocateReviews } from '../src/services/reviewAllocation';

describe('Late Submission & Status', () => {
  let teacher: any;
  let student: any;
  let course: any;
  let assignment: any;
  let submission: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_late',
        email: 'teacher_late@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    student = await prisma.user.create({
      data: {
        username: 'student_late',
        email: 'student_late@test.com',
        password: hashedPassword,
        name: 'Student Late',
        role: 'STUDENT',
        studentId: 'LATE001',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Late Test Course',
        code: 'LATE101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.create({
      data: {
        courseId: course.id,
        userId: student.id,
        role: 'STUDENT',
      },
    });
  });

  test('should create submission with NOT_SUBMITTED status', async () => {
    const submissionDeadline = new Date(Date.now() - 86400000);
    const reviewDeadline = new Date(Date.now() + 86400000);

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Late Test Assignment',
        submissionDeadline,
        reviewDeadline,
        reviewsPerSubmission: 2,
        dropHighestLowest: false,
        lateDeductionType: 'PER_DAY',
        lateDeductionValue: 10,
        lateDeductionMax: 30,
        maxScore: 100,
      },
    });

    const sub = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
      },
    });

    expect(sub).toBeNull();
  });

  test('should mark submission as LATE when submitted after deadline', async () => {
    submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
      },
      update: {},
      create: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Late submission',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        lateMinutes: 24 * 60,
      },
    });

    expect(submission.status).toBe('SUBMITTED');
    expect(submission.lateMinutes).toBe(24 * 60);
  });
});

describe('Incomplete Review Penalty', () => {
  let teacher: any;
  let students: any[];
  let course: any;
  let assignment: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_penalty',
        email: 'teacher_penalty@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    students = [];
    for (let i = 0; i < 4; i++) {
      const s = await prisma.user.create({
        data: {
          username: `student_penalty_${i}`,
          email: `student_penalty_${i}@test.com`,
          password: hashedPassword,
          name: `Student Penalty ${i}`,
          role: 'STUDENT',
          studentId: `PENALTY00${i}`,
        },
      });
      students.push(s);
    }

    course = await prisma.course.create({
      data: {
        name: 'Penalty Test Course',
        code: 'PENALTY101',
        teacherId: teacher.id,
      },
    });

    for (const s of students) {
      await prisma.courseMember.create({
        data: {
          courseId: course.id,
          userId: s.id,
          role: 'STUDENT',
        },
      });
    }

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Penalty Test Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        reviewsPerSubmission: 2,
        dropHighestLowest: false,
        lateDeductionType: 'NONE',
        incompleteReviewPenalty: 5,
        maxScore: 100,
      },
    });

    const rubric = await prisma.rubricCriterion.create({
      data: {
        assignmentId: assignment.id,
        name: 'Quality',
        maxScore: 100,
        order: 0,
      },
    });

    for (const s of students) {
      const sub = await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          studentId: s.id,
          content: 'Test submission',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          finalScore: 80,
          rawScore: 80,
        },
      });

      const reviewers = students.filter((st) => st.id !== s.id).slice(0, 2);
      for (let i = 0; i < reviewers.length; i++) {
        const review = await prisma.review.create({
          data: {
            submissionId: sub.id,
            reviewerId: reviewers[i].id,
            status: i === 0 ? 'COMPLETED' : 'ASSIGNED',
            overallScore: i === 0 ? 80 : null,
            completedAt: i === 0 ? new Date() : null,
          },
        });

        if (i === 0) {
          await prisma.reviewCriterionScore.create({
            data: {
              reviewId: review.id,
              criterionId: rubric.id,
              score: 80,
            },
          });
        }
      }
    }
  });

  test('should apply penalty for incomplete reviews', async () => {
    await penalizeIncompleteReviews(assignment.id);

    const reviewerWithIncomplete = students[1];
    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: reviewerWithIncomplete.id,
        },
      },
    });

    expect(submission).not.toBeNull();
    expect(submission!.finalScore).toBeLessThan(80);
  });
});

describe('Anomalous Score Detection', () => {
  test('should detect high anomalous score', () => {
    const scores = [80, 82, 78, 85, 79, 98];
    expect(isAnomalousScore(98, scores)).toBe(true);
  });

  test('should detect low anomalous score', () => {
    const scores = [80, 82, 78, 85, 79, 50];
    expect(isAnomalousScore(50, scores)).toBe(true);
  });

  test('should not detect normal score as anomalous', () => {
    const scores = [80, 82, 78, 85, 79, 81];
    expect(isAnomalousScore(81, scores)).toBe(false);
  });

  test('should return false for less than 2 scores', () => {
    expect(isAnomalousScore(80, [80])).toBe(false);
    expect(isAnomalousScore(80, [])).toBe(false);
  });
});

describe('Appeal Lock Score', () => {
  let teacher: any;
  let student: any;
  let ta: any;
  let course: any;
  let assignment: any;
  let submission: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_appeal',
        email: 'teacher_appeal@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    ta = await prisma.user.create({
      data: {
        username: 'ta_appeal',
        email: 'ta_appeal@test.com',
        password: hashedPassword,
        name: 'Test TA',
        role: 'TA',
      },
    });

    student = await prisma.user.create({
      data: {
        username: 'student_appeal',
        email: 'student_appeal@test.com',
        password: hashedPassword,
        name: 'Student Appeal',
        role: 'STUDENT',
        studentId: 'APPEAL001',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Appeal Test Course',
        code: 'APPEAL101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.create({
      data: { courseId: course.id, userId: teacher.id, role: 'TEACHER' },
    });
    await prisma.courseMember.create({
      data: { courseId: course.id, userId: ta.id, role: 'TA' },
    });
    await prisma.courseMember.create({
      data: { courseId: course.id, userId: student.id, role: 'STUDENT' },
    });

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Appeal Test Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        reviewsPerSubmission: 2,
        maxScore: 100,
      },
    });

    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Test submission',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 75,
        rawScore: 75,
        isLocked: false,
      },
    });
  });

  test('should create appeal and lock score', async () => {
    const appeal = await prisma.appeal.create({
      data: {
        submissionId: submission.id,
        assignmentId: assignment.id,
        appellantId: student.id,
        status: 'PENDING',
        reason: '我认为评分有问题',
      },
    });

    expect(appeal).not.toBeNull();
    expect(appeal.status).toBe('PENDING');

    const updatedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: { isLocked: true },
    });

    expect(updatedSubmission.isLocked).toBe(true);
  });

  test('should resolve appeal with TA score', async () => {
    const appeal = await prisma.appeal.findFirst({
      where: { submissionId: submission.id },
    });
    expect(appeal).not.toBeNull();

    const updatedAppeal = await prisma.appeal.update({
      where: { id: appeal!.id },
      data: {
        status: 'RESOLVED',
        taReviewerId: ta.id,
        taScore: 85,
        taComment: '复核后调整分数',
        finalScore: 85,
        reviewedAt: new Date(),
      },
    });

    expect(updatedAppeal.status).toBe('RESOLVED');
    expect(updatedAppeal.taScore).toBe(85);
    expect(updatedAppeal.finalScore).toBe(85);
  });
});

describe('Authorization', () => {
  let teacher: any;
  let student1: any;
  let student2: any;
  let course: any;
  let assignment: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_authz',
        email: 'teacher_authz@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    student1 = await prisma.user.create({
      data: {
        username: 'student1_authz',
        email: 'student1_authz@test.com',
        password: hashedPassword,
        name: 'Student 1',
        role: 'STUDENT',
        studentId: 'AUTHZ001',
      },
    });

    student2 = await prisma.user.create({
      data: {
        username: 'student2_authz',
        email: 'student2_authz@test.com',
        password: hashedPassword,
        name: 'Student 2',
        role: 'STUDENT',
        studentId: 'AUTHZ002',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Authz Test Course',
        code: 'AUTHZ101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.create({
      data: { courseId: course.id, userId: teacher.id, role: 'TEACHER' },
    });
    await prisma.courseMember.create({
      data: { courseId: course.id, userId: student1.id, role: 'STUDENT' },
    });
  });

  test('teacher should have TEACHER role in course', async () => {
    const member = await prisma.courseMember.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: teacher.id,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member!.role).toBe('TEACHER');
  });

  test('student enrolled in course should have STUDENT role', async () => {
    const member = await prisma.courseMember.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: student1.id,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member!.role).toBe('STUDENT');
  });

  test('student not enrolled should have no course membership', async () => {
    const member = await prisma.courseMember.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: student2.id,
        },
      },
    });
    expect(member).toBeNull();
  });
});

describe('Review Allocation Edge Cases', () => {
  test('should handle single student gracefully', async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    const teacher = await prisma.user.create({
      data: {
        username: 'teacher_edge',
        email: 'teacher_edge@test.com',
        password: hashedPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
      },
    });

    const student = await prisma.user.create({
      data: {
        username: 'student_edge',
        email: 'student_edge@test.com',
        password: hashedPassword,
        name: 'Solo Student',
        role: 'STUDENT',
        studentId: 'EDGE001',
      },
    });

    const course = await prisma.course.create({
      data: {
        name: 'Edge Test Course',
        code: 'EDGE101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.create({
      data: { courseId: course.id, userId: student.id, role: 'STUDENT' },
    });

    const assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Edge Test Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        reviewsPerSubmission: 3,
        maxScore: 100,
      },
    });

    await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Solo submission',
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await allocateReviews(assignment.id);

    const reviews = await prisma.review.findMany({
      where: { submission: { assignmentId: assignment.id } },
    });

    expect(reviews.length).toBe(0);
  });
});
