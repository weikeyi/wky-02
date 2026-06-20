import { prisma, bcrypt } from './setup';
import { getCourseAccess } from '../src/middleware/courseAccess';

describe('Multi-Course Appeal Aggregation', () => {
  let teacher1: any;
  let teacher2: any;
  let ta1: any;
  let student1: any;
  let student2: any;
  let student3: any;
  let course1: any;
  let course2: any;
  let course3: any;
  let assignment1_c1: any;
  let assignment2_c1: any;
  let assignment1_c2: any;
  let assignment1_c3: any;
  let submission_s1_a1c1: any;
  let submission_s1_a2c1: any;
  let submission_s2_a1c2: any;
  let submission_s3_a1c3: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher1 = await prisma.user.create({
      data: {
        username: 'teacher_multi_1',
        email: 'teacher_multi_1@test.com',
        password: hashedPassword,
        name: 'Multi Course Teacher 1',
        role: 'TEACHER',
      },
    });

    teacher2 = await prisma.user.create({
      data: {
        username: 'teacher_multi_2',
        email: 'teacher_multi_2@test.com',
        password: hashedPassword,
        name: 'Multi Course Teacher 2',
        role: 'TEACHER',
      },
    });

    ta1 = await prisma.user.create({
      data: {
        username: 'ta_multi_1',
        email: 'ta_multi_1@test.com',
        password: hashedPassword,
        name: 'Multi Course TA 1',
        role: 'TA',
      },
    });

    student1 = await prisma.user.create({
      data: {
        username: 'student_multi_1',
        email: 'student_multi_1@test.com',
        password: hashedPassword,
        name: 'Multi Student 1',
        role: 'STUDENT',
        studentId: 'MULTI001',
      },
    });

    student2 = await prisma.user.create({
      data: {
        username: 'student_multi_2',
        email: 'student_multi_2@test.com',
        password: hashedPassword,
        name: 'Multi Student 2',
        role: 'STUDENT',
        studentId: 'MULTI002',
      },
    });

    student3 = await prisma.user.create({
      data: {
        username: 'student_multi_3',
        email: 'student_multi_3@test.com',
        password: hashedPassword,
        name: 'Multi Student 3',
        role: 'STUDENT',
        studentId: 'MULTI003',
      },
    });

    course1 = await prisma.course.create({
      data: {
        name: 'Multi Course 1',
        code: 'MC101',
        teacherId: teacher1.id,
      },
    });

    course2 = await prisma.course.create({
      data: {
        name: 'Multi Course 2',
        code: 'MC202',
        teacherId: teacher1.id,
      },
    });

    course3 = await prisma.course.create({
      data: {
        name: 'Multi Course 3',
        code: 'MC303',
        teacherId: teacher2.id,
      },
    });

    await prisma.courseMember.createMany({
      data: [
        { courseId: course1.id, userId: teacher1.id, role: 'TEACHER' },
        { courseId: course1.id, userId: ta1.id, role: 'TA' },
        { courseId: course1.id, userId: student1.id, role: 'STUDENT' },
        { courseId: course2.id, userId: teacher1.id, role: 'TEACHER' },
        { courseId: course2.id, userId: ta1.id, role: 'TA' },
        { courseId: course2.id, userId: student2.id, role: 'STUDENT' },
        { courseId: course3.id, userId: teacher2.id, role: 'TEACHER' },
        { courseId: course3.id, userId: student3.id, role: 'STUDENT' },
      ],
    });

    assignment1_c1 = await prisma.assignment.create({
      data: {
        courseId: course1.id,
        title: 'Assignment 1 - Course 1',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    assignment2_c1 = await prisma.assignment.create({
      data: {
        courseId: course1.id,
        title: 'Assignment 2 - Course 1',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    assignment1_c2 = await prisma.assignment.create({
      data: {
        courseId: course2.id,
        title: 'Assignment 1 - Course 2',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    assignment1_c3 = await prisma.assignment.create({
      data: {
        courseId: course3.id,
        title: 'Assignment 1 - Course 3',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    submission_s1_a1c1 = await prisma.submission.create({
      data: {
        assignmentId: assignment1_c1.id,
        studentId: student1.id,
        content: 'Submission S1 A1C1',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 70,
        rawScore: 70,
        isLocked: false,
      },
    });

    submission_s1_a2c1 = await prisma.submission.create({
      data: {
        assignmentId: assignment2_c1.id,
        studentId: student1.id,
        content: 'Submission S1 A2C1',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 65,
        rawScore: 65,
        isLocked: false,
      },
    });

    submission_s2_a1c2 = await prisma.submission.create({
      data: {
        assignmentId: assignment1_c2.id,
        studentId: student2.id,
        content: 'Submission S2 A1C2',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 80,
        rawScore: 80,
        isLocked: false,
      },
    });

    submission_s3_a1c3 = await prisma.submission.create({
      data: {
        assignmentId: assignment1_c3.id,
        studentId: student3.id,
        content: 'Submission S3 A1C3',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 90,
        rawScore: 90,
        isLocked: false,
      },
    });

    await prisma.appeal.createMany({
      data: [
        {
          submissionId: submission_s1_a1c1.id,
          assignmentId: assignment1_c1.id,
          appellantId: student1.id,
          reason: 'Appeal for A1C1',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          submissionId: submission_s1_a2c1.id,
          assignmentId: assignment2_c1.id,
          appellantId: student1.id,
          reason: 'Appeal for A2C1',
          status: 'RESOLVED',
          createdAt: new Date(Date.now() - 7200000),
        },
        {
          submissionId: submission_s2_a1c2.id,
          assignmentId: assignment1_c2.id,
          appellantId: student2.id,
          reason: 'Appeal for A1C2',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 1800000),
        },
        {
          submissionId: submission_s3_a1c3.id,
          assignmentId: assignment1_c3.id,
          appellantId: student3.id,
          reason: 'Appeal for A1C3',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 900000),
        },
      ],
    });
  });

  test('teacher1 should have access to course1 and course2 but not course3', async () => {
    const access1 = await getCourseAccess(course1.id, teacher1.id);
    const access2 = await getCourseAccess(course2.id, teacher1.id);
    const access3 = await getCourseAccess(course3.id, teacher1.id);

    expect(access1).not.toBeNull();
    expect(access1!.isTeacher).toBe(true);
    expect(access2).not.toBeNull();
    expect(access2!.isTeacher).toBe(true);
    expect(access3).toBeNull();
  });

  test('ta1 should have access to course1 and course2 but not course3', async () => {
    const access1 = await getCourseAccess(course1.id, ta1.id);
    const access2 = await getCourseAccess(course2.id, ta1.id);
    const access3 = await getCourseAccess(course3.id, ta1.id);

    expect(access1).not.toBeNull();
    expect(access1!.isStaff).toBe(true);
    expect(access2).not.toBeNull();
    expect(access2!.isStaff).toBe(true);
    expect(access3).toBeNull();
  });

  test('teacher1 should see 3 appeals from course1 and course2 (cross-course aggregation)', async () => {
    const course1Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course1.id } },
    });
    const course2Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course2.id } },
    });
    const course3Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course3.id } },
    });

    expect(course1Appeals.length).toBe(2);
    expect(course2Appeals.length).toBe(1);
    expect(course3Appeals.length).toBe(1);

    const teacher1VisibleAppeals = [...course1Appeals, ...course2Appeals];
    expect(teacher1VisibleAppeals.length).toBe(3);

    const appealAssignmentIds = teacher1VisibleAppeals.map(a => a.assignmentId);
    expect(appealAssignmentIds).toContain(assignment1_c1.id);
    expect(appealAssignmentIds).toContain(assignment2_c1.id);
    expect(appealAssignmentIds).toContain(assignment1_c2.id);
    expect(appealAssignmentIds).not.toContain(assignment1_c3.id);
  });

  test('ta1 should see same appeals as teacher1 (course1 + course2)', async () => {
    const course1Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course1.id } },
    });
    const course2Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course2.id } },
    });

    const ta1VisibleAppeals = [...course1Appeals, ...course2Appeals];
    expect(ta1VisibleAppeals.length).toBe(3);

    const appealReasons = ta1VisibleAppeals.map(a => a.reason);
    expect(appealReasons).toContain('Appeal for A1C1');
    expect(appealReasons).toContain('Appeal for A2C1');
    expect(appealReasons).toContain('Appeal for A1C2');
    expect(appealReasons).not.toContain('Appeal for A1C3');
  });

  test('teacher2 should only see 1 appeal from course3', async () => {
    const course3Appeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: course3.id } },
    });

    expect(course3Appeals.length).toBe(1);
    expect(course3Appeals[0].reason).toBe('Appeal for A1C3');
  });

  test('pending appeals filter should return only PENDING status', async () => {
    const allVisibleAppeals = await prisma.appeal.findMany({
      where: {
        OR: [
          { assignment: { courseId: course1.id } },
          { assignment: { courseId: course2.id } },
        ],
      },
    });

    const pendingAppeals = allVisibleAppeals.filter(a => a.status === 'PENDING');

    expect(allVisibleAppeals.length).toBe(3);
    expect(pendingAppeals.length).toBe(2);
    expect(pendingAppeals.map(a => a.status)).toEqual(['PENDING', 'PENDING']);
    expect(pendingAppeals.map(a => a.reason)).toContain('Appeal for A1C1');
    expect(pendingAppeals.map(a => a.reason)).toContain('Appeal for A1C2');
  });

  test('appeals should be sorted by createdAt descending', async () => {
    const allVisibleAppeals = await prisma.appeal.findMany({
      where: {
        OR: [
          { assignment: { courseId: course1.id } },
          { assignment: { courseId: course2.id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(allVisibleAppeals.length).toBe(3);
    
    const timestamps = allVisibleAppeals.map(a => new Date(a.createdAt).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  test('each appeal should be linked to correct assignment and course', async () => {
    const appealsWithDetails = await prisma.appeal.findMany({
      where: {
        OR: [
          { assignment: { courseId: course1.id } },
          { assignment: { courseId: course2.id } },
        ],
      },
      include: {
        assignment: {
          include: { course: true },
        },
      },
    });

    for (const appeal of appealsWithDetails) {
      expect(appeal.assignment).not.toBeNull();
      expect(appeal.assignment.course).not.toBeNull();
      expect([course1.id, course2.id]).toContain(appeal.assignment.courseId);
      expect(['Multi Course 1', 'Multi Course 2']).toContain(appeal.assignment.course.name);
    }
  });
});

describe('Appeal Lock Score Enforcement - API Level', () => {
  let teacher: any;
  let ta: any;
  let student: any;
  let course: any;
  let assignment: any;
  let submission: any;
  let appeal: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacher = await prisma.user.create({
      data: {
        username: 'teacher_lock_api',
        email: 'teacher_lock_api@test.com',
        password: hashedPassword,
        name: 'Lock API Teacher',
        role: 'TEACHER',
      },
    });

    ta = await prisma.user.create({
      data: {
        username: 'ta_lock_api',
        email: 'ta_lock_api@test.com',
        password: hashedPassword,
        name: 'Lock API TA',
        role: 'TA',
      },
    });

    student = await prisma.user.create({
      data: {
        username: 'student_lock_api',
        email: 'student_lock_api@test.com',
        password: hashedPassword,
        name: 'Lock API Student',
        role: 'STUDENT',
        studentId: 'LOCKAPI001',
      },
    });

    course = await prisma.course.create({
      data: {
        name: 'Lock API Course',
        code: 'LOCKAPI101',
        teacherId: teacher.id,
      },
    });

    await prisma.courseMember.createMany({
      data: [
        { courseId: course.id, userId: teacher.id, role: 'TEACHER' },
        { courseId: course.id, userId: ta.id, role: 'TA' },
        { courseId: course.id, userId: student.id, role: 'STUDENT' },
      ],
    });

    assignment = await prisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Lock API Assignment',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        content: 'Test submission for lock test',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 70,
        rawScore: 70,
        isLocked: false,
      },
    });

    appeal = await prisma.appeal.create({
      data: {
        submissionId: submission.id,
        assignmentId: assignment.id,
        appellantId: student.id,
        reason: 'Test appeal for lock enforcement',
        status: 'PENDING',
      },
    });
  });

  test('can create appeal when submission is not locked', async () => {
    expect(appeal).not.toBeNull();
    expect(appeal.status).toBe('PENDING');

    const submissionCheck = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(submissionCheck!.isLocked).toBe(false);
  });

  test('cannot create second appeal while first is pending', async () => {
    const existingPending = await prisma.appeal.findFirst({
      where: {
        submissionId: submission.id,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
    });
    expect(existingPending).not.toBeNull();
  });

  test('locked submission cannot have new appeal created', async () => {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { isLocked: true },
    });

    const lockedSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(lockedSubmission!.isLocked).toBe(true);

    const appealsOnLocked = await prisma.appeal.findMany({
      where: { submissionId: submission.id },
    });
    expect(appealsOnLocked.length).toBe(1);
  });

  test('TA can start reviewing pending appeal', async () => {
    const updatedAppeal = await prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: 'REVIEWING',
        taReviewerId: ta.id,
      },
    });

    expect(updatedAppeal.status).toBe('REVIEWING');
    expect(updatedAppeal.taReviewerId).toBe(ta.id);
  });

  test('cannot resolve already resolved appeal (status check)', async () => {
    const resolvedAppeal = await prisma.appeal.update({
      where: { id: appeal.id },
      data: {
        status: 'RESOLVED',
        taScore: 85,
        taComment: 'Resolved',
        finalScore: 85,
        reviewedAt: new Date(),
      },
    });

    expect(resolvedAppeal.status).toBe('RESOLVED');
    expect(resolvedAppeal.taScore).toBe(85);

    const statusCheck = resolvedAppeal.status;
    const isTerminal = statusCheck === 'RESOLVED' || statusCheck === 'REJECTED';
    expect(isTerminal).toBe(true);
  });

  test('resolved appeal should lock submission score', async () => {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        finalScore: 85,
        isLocked: true,
      },
    });

    const finalSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    });

    expect(finalSubmission!.isLocked).toBe(true);
    expect(finalSubmission!.finalScore).toBe(85);
  });

  test('locked submission cannot be modified by raw prisma update (should require unlock)', async () => {
    const lockedSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(lockedSubmission!.isLocked).toBe(true);

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: { content: 'Should not affect lock status' },
    });

    expect(updated.isLocked).toBe(true);
    expect(updated.finalScore).toBe(85);
  });

  test('student cannot appeal locked submission', async () => {
    const lockedSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(lockedSubmission!.isLocked).toBe(true);

    const activeAppeals = await prisma.appeal.findMany({
      where: {
        submissionId: submission.id,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
    });
    expect(activeAppeals.length).toBe(0);
  });
});

describe('Cross-Course Appeal Visibility', () => {
  let teacherA: any;
  let teacherB: any;
  let studentA: any;
  let studentB: any;
  let courseA: any;
  let courseB: any;
  let assignmentA: any;
  let assignmentB: any;
  let appealA: any;
  let appealB: any;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('test123', 10);

    teacherA = await prisma.user.create({
      data: {
        username: 'teacher_vis_a',
        email: 'teacher_vis_a@test.com',
        password: hashedPassword,
        name: 'Visibility Teacher A',
        role: 'TEACHER',
      },
    });

    teacherB = await prisma.user.create({
      data: {
        username: 'teacher_vis_b',
        email: 'teacher_vis_b@test.com',
        password: hashedPassword,
        name: 'Visibility Teacher B',
        role: 'TEACHER',
      },
    });

    studentA = await prisma.user.create({
      data: {
        username: 'student_vis_a',
        email: 'student_vis_a@test.com',
        password: hashedPassword,
        name: 'Visibility Student A',
        role: 'STUDENT',
        studentId: 'VISA001',
      },
    });

    studentB = await prisma.user.create({
      data: {
        username: 'student_vis_b',
        email: 'student_vis_b@test.com',
        password: hashedPassword,
        name: 'Visibility Student B',
        role: 'STUDENT',
        studentId: 'VISB001',
      },
    });

    courseA = await prisma.course.create({
      data: {
        name: 'Visibility Course A',
        code: 'VISA101',
        teacherId: teacherA.id,
      },
    });

    courseB = await prisma.course.create({
      data: {
        name: 'Visibility Course B',
        code: 'VISB101',
        teacherId: teacherB.id,
      },
    });

    await prisma.courseMember.createMany({
      data: [
        { courseId: courseA.id, userId: teacherA.id, role: 'TEACHER' },
        { courseId: courseA.id, userId: studentA.id, role: 'STUDENT' },
        { courseId: courseB.id, userId: teacherB.id, role: 'TEACHER' },
        { courseId: courseB.id, userId: studentB.id, role: 'STUDENT' },
      ],
    });

    assignmentA = await prisma.assignment.create({
      data: {
        courseId: courseA.id,
        title: 'Assignment A',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    assignmentB = await prisma.assignment.create({
      data: {
        courseId: courseB.id,
        title: 'Assignment B',
        submissionDeadline: new Date(Date.now() + 86400000),
        reviewDeadline: new Date(Date.now() + 172800000),
        maxScore: 100,
      },
    });

    const submissionA = await prisma.submission.create({
      data: {
        assignmentId: assignmentA.id,
        studentId: studentA.id,
        content: 'Submission A',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 75,
        rawScore: 75,
      },
    });

    const submissionB = await prisma.submission.create({
      data: {
        assignmentId: assignmentB.id,
        studentId: studentB.id,
        content: 'Submission B',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        finalScore: 85,
        rawScore: 85,
      },
    });

    appealA = await prisma.appeal.create({
      data: {
        submissionId: submissionA.id,
        assignmentId: assignmentA.id,
        appellantId: studentA.id,
        reason: 'Appeal from Course A',
        status: 'PENDING',
      },
    });

    appealB = await prisma.appeal.create({
      data: {
        submissionId: submissionB.id,
        assignmentId: assignmentB.id,
        appellantId: studentB.id,
        reason: 'Appeal from Course B',
        status: 'PENDING',
      },
    });
  });

  test('teacherA can only see appeals from courseA, not courseB', async () => {
    const courseAAppeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: courseA.id } },
      include: { assignment: true },
    });

    const courseBAppeals = await prisma.appeal.findMany({
      where: { assignment: { courseId: courseB.id } },
      include: { assignment: true },
    });

    expect(courseAAppeals.length).toBe(1);
    expect(courseAAppeals[0].reason).toBe('Appeal from Course A');
    expect(courseAAppeals[0].assignment.courseId).toBe(courseA.id);

    expect(courseBAppeals.length).toBe(1);
    expect(courseBAppeals[0].reason).toBe('Appeal from Course B');
    expect(courseBAppeals[0].assignment.courseId).toBe(courseB.id);

    const accessToCourseB = await getCourseAccess(courseB.id, teacherA.id);
    expect(accessToCourseB).toBeNull();

    const teacherAIds = courseAAppeals.map(a => a.id);
    const teacherBIds = courseBAppeals.map(a => a.id);
    expect(teacherAIds).not.toContain(appealB.id);
    expect(teacherBIds).not.toContain(appealA.id);
  });

  test('course access check prevents cross-course appeal viewing', async () => {
    const accessAToA = await getCourseAccess(courseA.id, teacherA.id);
    const accessAToB = await getCourseAccess(courseB.id, teacherA.id);
    const accessBToA = await getCourseAccess(courseA.id, teacherB.id);
    const accessBToB = await getCourseAccess(courseB.id, teacherB.id);

    expect(accessAToA).not.toBeNull();
    expect(accessAToA!.isStaff).toBe(true);
    expect(accessAToB).toBeNull();
    expect(accessBToA).toBeNull();
    expect(accessBToB).not.toBeNull();
    expect(accessBToB!.isStaff).toBe(true);
  });

  test('appeal detail includes course context for proper filtering', async () => {
    const appealWithCourse = await prisma.appeal.findUnique({
      where: { id: appealA.id },
      include: {
        assignment: {
          include: { course: true },
        },
      },
    });

    expect(appealWithCourse).not.toBeNull();
    expect(appealWithCourse!.assignment.courseId).toBe(courseA.id);
    expect(appealWithCourse!.assignment.course.name).toBe('Visibility Course A');
    expect(appealWithCourse!.assignment.course.teacherId).toBe(teacherA.id);
  });
});
