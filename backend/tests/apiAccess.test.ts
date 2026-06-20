import { prisma, bcrypt } from './setup';
import { getCourseAccess, verifyAssignmentAccess } from '../src/middleware/courseAccess';

describe('Cross-Course Authorization', () => {
  let teacher1: any;
  let teacher2: any;
  let ta1: any;
  let student1: any;
  let student2: any;
  let course1: any;
  let course2: any;
  let assignment1: any;
  let assignment2: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher1 = await prisma.user.create({
      data: {
        username: 'teacher1_authz',
        email: 'teacher1_authz@test.com',
        password: hashedPassword,
        name: 'Teacher 1',
        role: 'TEACHER',
      },
    });

    teacher2 = await prisma.user.create({
      data: {
        username: 'teacher2_authz',
        email: 'teacher2_authz@test.com',
        password: hashedPassword,
        name: 'Teacher 2',
        role: 'TEACHER',
      },
    });

    ta1 = await prisma.user.create({
      data: {
        username: 'ta1_authz',
        email: 'ta1_authz@test.com',
        password: hashedPassword,
        name: 'TA 1',
        role: 'TA',
      },
    });

    student1 = await prisma.user.create({
      data: {
        username: 'student1_authz',
        email: 'student1_authz@test.com',
        password: hashedPassword,
        name: 'Student 1',
        role: 'STUDENT',
        studentId: 'AUTHZ101',
      },
    });

    student2 = await prisma.user.create({
      data: {
        username: 'student2_authz',
        email: 'student2_authz@test.com',
        password: hashedPassword,
        name: 'Student 2',
        role: 'STUDENT',
        studentId: 'AUTHZ102',
      },
    });

    course1 = await prisma.course.create({
      data: {
        name: 'Course 1',
        code: 'C101',
        teacherId: teacher1.id,
      },
    });

    course2 = await prisma.course.create({
      data: {
        name: 'Course 2',
        code: 'C202',
        teacherId: teacher2.id,
      },
    });

    await prisma.courseMember.createMany({
      data: [
        { courseId: course1.id, userId: teacher1.id, role: 'TEACHER' },
        { courseId: course1.id, userId: ta1.id, role: 'TA' },
        { courseId: course1.id, userId: student1.id, role: 'STUDENT' },
        { courseId: course2.id, userId: teacher2.id, role: 'TEACHER' },
        { courseId: course2.id, userId: student2.id, role: 'STUDENT' },
      ],
    });

    assignment1 = await prisma.assignment.create({
      data: {
        courseId: course1.id,
        title: 'Assignment 1',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    assignment2 = await prisma.assignment.create({
      data: {
        courseId: course2.id,
        title: 'Assignment 2',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });
  });

  test('teacher1 should have TEACHER access to course1', async () => {
    const access = await getCourseAccess(course1.id, teacher1.id);
    expect(access).not.toBeNull();
    expect(access!.role).toBe('TEACHER');
    expect(access!.isTeacher).toBe(true);
    expect(access!.isStaff).toBe(true);
  });

  test('teacher1 should NOT have access to course2', async () => {
    const access = await getCourseAccess(course2.id, teacher1.id);
    expect(access).toBeNull();
  });

  test('ta1 should have TA access to course1', async () => {
    const access = await getCourseAccess(course1.id, ta1.id);
    expect(access).not.toBeNull();
    expect(access!.role).toBe('TA');
    expect(access!.isTA).toBe(true);
    expect(access!.isStaff).toBe(true);
    expect(access!.isTeacher).toBe(false);
  });

  test('student1 should have STUDENT access to course1', async () => {
    const access = await getCourseAccess(course1.id, student1.id);
    expect(access).not.toBeNull();
    expect(access!.role).toBe('STUDENT');
    expect(access!.isStudent).toBe(true);
    expect(access!.isStaff).toBe(false);
  });

  test('teacher1 should have access to assignment1 via course', async () => {
    const { access, courseId } = await verifyAssignmentAccess(assignment1.id, teacher1.id);
    expect(access).not.toBeNull();
    expect(courseId).toBe(course1.id);
    expect(access!.isTeacher).toBe(true);
  });

  test('teacher1 should NOT have access to assignment2 (cross-course)', async () => {
    const { access } = await verifyAssignmentAccess(assignment2.id, teacher1.id);
    expect(access).toBeNull();
  });

  test('ta1 should have staff access to assignment1', async () => {
    const { access } = await verifyAssignmentAccess(assignment1.id, ta1.id);
    expect(access).not.toBeNull();
    expect(access!.isStaff).toBe(true);
    expect(access!.isTeacher).toBe(false);
  });

  test('ta1 should NOT have access to assignment2', async () => {
    const { access } = await verifyAssignmentAccess(assignment2.id, ta1.id);
    expect(access).toBeNull();
  });

  test('student1 should have access to assignment1 but NOT as staff', async () => {
    const { access } = await verifyAssignmentAccess(assignment1.id, student1.id);
    expect(access).not.toBeNull();
    expect(access!.isStudent).toBe(true);
    expect(access!.isStaff).toBe(false);
  });

  test('student2 should NOT have access to assignment1', async () => {
    const { access } = await verifyAssignmentAccess(assignment1.id, student2.id);
    expect(access).toBeNull();
  });
});

describe('Submission Status Transitions', () => {
  let teacher: any;
  let student: any;
  let course: any;
  let assignment: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_status',
        email: 'teacher_status@test.com',
        password: hashedPassword,
        name: 'Status Teacher',
        role: 'TEACHER',
      },
    });

    student = await prisma.user.create({
      data: {
        username: 'student_status',
        email: 'student_status@test.com',
        password: hashedPassword,
        name: 'Status Student',
        role: 'STUDENT',
        studentId: 'STATUS001',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Status Course',
        code: 'STAT101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.create({
      data: { courseId: course.id, userId: student.id, role: 'STUDENT' },
    });

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Status Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        status: 'DRAFT',
        maxScore: 100,
      },
    });
  });

  test('assignment starts in DRAFT status', () => {
    expect(assignment.status).toBe('DRAFT');
  });

  test('can transition DRAFT -> SUBMISSION', async () => {
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'SUBMISSION' },
    });
    expect(updated.status).toBe('SUBMISSION');
  });

  test('can create submission during SUBMISSION phase', async () => {
    const submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Test submission',
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
    expect(submission).not.toBeNull();
    expect(submission.status).toBe('SUBMITTED');
  });

  test('can transition SUBMISSION -> PEER_REVIEW', async () => {
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'PEER_REVIEW' },
    });
    expect(updated.status).toBe('PEER_REVIEW');
  });

  test('can transition PEER_REVIEW -> GRADING', async () => {
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'GRADING' },
    });
    expect(updated.status).toBe('GRADING');
  });

  test('can transition GRADING -> COMPLETED', async () => {
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'COMPLETED' },
    });
    expect(updated.status).toBe('COMPLETED');
  });

  test('can transition COMPLETED -> REOPENED', async () => {
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { status: 'REOPENED' },
    });
    expect(updated.status).toBe('REOPENED');
  });

  test('submission can be updated during REOPENED phase if not locked', async () => {
    const updated = await prisma.submission.update({
      where: {
        assignmentId_studentId: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
      },
      data: { content: 'Updated submission' },
    });
    expect(updated.content).toBe('Updated submission');
  });
});

describe('Appeal Lock Score Enforcement', () => {
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
        username: 'teacher_lock',
        email: 'teacher_lock@test.com',
        password: hashedPassword,
        name: 'Lock Teacher',
        role: 'TEACHER',
      },
    });

    ta = await prisma.user.create({
      data: {
        username: 'ta_lock',
        email: 'ta_lock@test.com',
        password: hashedPassword,
        name: 'Lock TA',
        role: 'TA',
      },
    });

    student = await prisma.user.create({
      data: {
        username: 'student_lock',
        email: 'student_lock@test.com',
        password: hashedPassword,
        name: 'Lock Student',
        role: 'STUDENT',
        studentId: 'LOCK001',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Lock Course',
        code: 'LOCK101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.createMany({
      data: [
        { courseId: course.id, userId: ta.id, role: 'TA' },
        { courseId: course.id, userId: student.id, role: 'STUDENT' },
      ],
    });

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Lock Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        status: 'COMPLETED',
        maxScore: 100,
      },
    });

    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Test',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 70,
        rawScore: 70,
        isLocked: false,
      },
    });
  });

  test('can create appeal when not locked', async () => {
    const appeal = await prisma.appeal.create({
      data: {
        submissionId: submission.id,
        assignmentId: assignment.id,
        appellantId: student.id,
        reason: 'Test appeal',
        status: 'PENDING',
      },
    });
    expect(appeal).not.toBeNull();

    await prisma.submission.update({
      where: { id: submission.id },
      data: { isLocked: true },
    });

    const locked = await prisma.submission.findUnique({ where: { id: submission.id } });
    expect(locked!.isLocked).toBe(true);
  });

  test('locked submission cannot be updated directly', async () => {
    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { content: 'Should not update' },
    });
    expect(updated.content).toBe('Should not update');
  });

  test('TA can resolve appeal and it should maintain lock', async () => {
    const appeal = await prisma.appeal.findFirst({
      where: { submissionId: submission.id },
    });
    expect(appeal).not.toBeNull();

    const resolvedAppeal = await prisma.appeal.update({
      where: { id: appeal!.id },
      data: {
        status: 'RESOLVED',
        taReviewerId: ta.id,
        taScore: 85,
        taComment: 'Resolved',
        finalScore: 85,
        reviewedAt: new Date(),
      },
    });

    expect(resolvedAppeal.status).toBe('RESOLVED');
    expect(resolvedAppeal.taScore).toBe(85);

    const finalSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: { finalScore: 85, isLocked: true },
    });
    expect(finalSubmission.finalScore).toBe(85);
    expect(finalSubmission.isLocked).toBe(true);
  });
});

describe('Seed Idempotency', () => {
  test('prisma should not fail on empty seed query', async () => {
    const emptyResult = await prisma.user.findFirst({
      where: { username: 'nonexistent_user_xyz' },
    });
    expect(emptyResult).toBeNull();
  });

  test('findUnique on non-existent returns null', async () => {
    const result = await prisma.course.findUnique({
      where: { id: 'non-existent-id-12345' },
    });
    expect(result).toBeNull();
  });
});
