import prisma from '../prisma';
import { Submission, User } from '@prisma/client';

interface StudentInfo {
  id: string;
  groupId: string | null;
}

export async function allocateReviews(assignmentId: string): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      rubric: true,
      submissions: {
        where: {
          status: {
            in: ['SUBMITTED', 'LATE'],
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error('作业不存在');
  }

  const submissions = assignment.submissions;
  if (submissions.length === 0) {
    return;
  }

  const studentIds = submissions.map((s) => s.studentId);

  const studentGroupMap = await getStudentGroupMap(assignment.courseId, studentIds);

  const studentInfos: StudentInfo[] = studentIds.map((id) => ({
    id,
    groupId: studentGroupMap.get(id) || null,
  }));

  const reviewsPerSubmission = assignment.reviewsPerSubmission;

  const submissionReviewCount = new Map<string, number>();
  const reviewerAssignCount = new Map<string, number>();

  submissions.forEach((s) => submissionReviewCount.set(s.id, 0));
  studentInfos.forEach((s) => reviewerAssignCount.set(s.id, 0));

  const shuffledStudents = [...studentInfos].sort(() => Math.random() - 0.5);

  const existingReviews = await prisma.review.findMany({
    where: {
      submission: {
        assignmentId,
      },
    },
  });

  const existingPairs = new Set(existingReviews.map((r) => `${r.submissionId}-${r.reviewerId}`));

  for (const submission of submissions) {
    const submitterId = submission.studentId;
    const submitterGroupId = studentGroupMap.get(submitterId) || null;

    const availableReviewers = shuffledStudents
      .filter((s) => s.id !== submitterId)
      .filter((s) => {
        if (submitterGroupId && s.groupId === submitterGroupId) {
          return false;
        }
        return true;
      })
      .filter((s) => !existingPairs.has(`${submission.id}-${s.id}`))
      .sort((a, b) => {
        const countA = reviewerAssignCount.get(a.id) || 0;
        const countB = reviewerAssignCount.get(b.id) || 0;
        return countA - countB;
      });

    let assigned = submissionReviewCount.get(submission.id) || 0;
    let needed = reviewsPerSubmission - assigned;

    for (const reviewer of availableReviewers) {
      if (needed <= 0) break;

      await prisma.review.create({
        data: {
          submissionId: submission.id,
          reviewerId: reviewer.id,
          status: 'ASSIGNED',
        },
      });

      submissionReviewCount.set(submission.id, (submissionReviewCount.get(submission.id) || 0) + 1);
      reviewerAssignCount.set(reviewer.id, (reviewerAssignCount.get(reviewer.id) || 0) + 1);
      existingPairs.add(`${submission.id}-${reviewer.id}`);
      needed--;
    }
  }

  await balanceReviewLoad(assignmentId, studentInfos, reviewsPerSubmission, submissions);
}

async function getStudentGroupMap(courseId: string, studentIds: string[]): Promise<Map<string, string>> {
  const groupMembers = await prisma.groupMember.findMany({
    where: {
      group: {
        courseId,
      },
      userId: {
        in: studentIds,
      },
    },
    select: {
      userId: true,
      groupId: true,
    },
  });

  const map = new Map<string, string>();
  groupMembers.forEach((gm) => {
    map.set(gm.userId, gm.groupId);
  });

  return map;
}

async function balanceReviewLoad(
  assignmentId: string,
  students: StudentInfo[],
  reviewsPerSubmission: number,
  submissions: Submission[]
) {
  const reviews = await prisma.review.findMany({
    where: {
      submission: {
        assignmentId,
      },
    },
  });

  const reviewerCount = new Map<string, number>();
  students.forEach((s) => reviewerCount.set(s.id, 0));
  reviews.forEach((r) => {
    reviewerCount.set(r.reviewerId, (reviewerCount.get(r.reviewerId) || 0) + 1);
  });

  const totalReviewsNeeded = submissions.length * reviewsPerSubmission;
  const averageReviews = Math.floor(totalReviewsNeeded / students.length);
}

export function validateRubricScores(
  scores: { criterionId: string; score: number }[],
  rubric: { id: string; maxScore: number }[]
): boolean {
  const rubricMap = new Map(rubric.map((r) => [r.id, r.maxScore]));

  for (const score of scores) {
    const maxScore = rubricMap.get(score.criterionId);
    if (maxScore === undefined) {
      return false;
    }
    if (score.score < 0 || score.score > maxScore) {
      return false;
    }
  }

  return true;
}
