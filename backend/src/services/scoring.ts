import prisma from '../prisma';

type LateDeductionType = 'NONE' | 'FIXED' | 'PER_DAY' | 'PER_HOUR';

interface AssignmentLike {
  lateDeductionType: string;
  lateDeductionValue: number;
  lateDeductionMax: number;
  maxScore: number;
}

interface SubmissionLike {
  lateMinutes: number;
  status: string;
}

interface ReviewScore {
  reviewId: string;
  totalScore: number;
}

export async function calculateSubmissionScore(
  submissionId: string,
  dropHighestLowest: boolean = true
): Promise<number | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          rubric: true,
        },
      },
      reviews: {
        where: {
          status: 'COMPLETED',
        },
        include: {
          criterionScores: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error('提交不存在');
  }

  const completedReviews = submission.reviews.filter((r) => r.status === 'COMPLETED');
  if (completedReviews.length === 0) {
    return null;
  }

  const reviewScores: ReviewScore[] = completedReviews.map((review) => {
    let total = 0;
    review.criterionScores.forEach((cs) => {
      total += cs.score;
    });
    return {
      reviewId: review.id,
      totalScore: total,
    };
  });

  let finalScores = reviewScores.map((r) => r.totalScore);

  if (dropHighestLowest && finalScores.length >= 3) {
    finalScores = finalScores.sort((a, b) => a - b);
    finalScores = finalScores.slice(1, -1);
  }

  const avgScore = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length;

  return Math.round(avgScore * 100) / 100;
}

export async function calculateFinalScore(submissionId: string): Promise<number | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: true,
    },
  });

  if (!submission) {
    throw new Error('提交不存在');
  }

  const rawScore = await calculateSubmissionScore(
    submissionId,
    submission.assignment.dropHighestLowest
  );

  if (rawScore === null) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { rawScore: null, finalScore: null },
    });
    return null;
  }

  let finalScore = rawScore;

  if (submission.status === 'LATE' && submission.assignment.lateDeductionType !== 'NONE') {
    finalScore = applyLateDeduction(finalScore, submission, submission.assignment);
  }

  finalScore = Math.max(0, Math.min(submission.assignment.maxScore, finalScore));

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      rawScore: rawScore,
      finalScore: Math.round(finalScore * 100) / 100,
    },
  });

  return Math.round(finalScore * 100) / 100;
}

function applyLateDeduction(
  score: number,
  submission: { lateMinutes: number; status: string },
  assignment: {
    lateDeductionType: string;
    lateDeductionValue: number;
    lateDeductionMax: number;
    maxScore: number;
  }
): number {
  let deduction = 0;

  switch (assignment.lateDeductionType) {
    case 'FIXED':
      deduction = assignment.lateDeductionValue;
      break;
    case 'PER_DAY':
      const daysLate = Math.ceil(submission.lateMinutes / (24 * 60));
      deduction = daysLate * assignment.lateDeductionValue;
      break;
    case 'PER_HOUR':
      const hoursLate = Math.ceil(submission.lateMinutes / 60);
      deduction = hoursLate * assignment.lateDeductionValue;
      break;
    default:
      return score;
  }

  const maxDeduction = (assignment.lateDeductionMax / 100) * assignment.maxScore;
  deduction = Math.min(deduction, maxDeduction);

  return score - deduction;
}

export async function penalizeIncompleteReviews(assignmentId: string): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      submissions: {
        where: {
          status: {
            in: ['SUBMITTED', 'LATE'],
          },
        },
      },
    },
  });

  if (!assignment) return;

  const penalty = assignment.incompleteReviewPenalty;
  if (penalty <= 0) return;

  const allReviews = await prisma.review.findMany({
    where: {
      submission: { assignmentId },
    },
  });

  const reviewerReviewMap = new Map<string, typeof allReviews>();
  allReviews.forEach((r) => {
    if (!reviewerReviewMap.has(r.reviewerId)) {
      reviewerReviewMap.set(r.reviewerId, []);
    }
    reviewerReviewMap.get(r.reviewerId)!.push(r);
  });

  for (const [reviewerId, reviews] of reviewerReviewMap) {
    const incompleteCount = reviews.filter((r) => r.status !== 'COMPLETED').length;
    if (incompleteCount === 0) continue;

    const submission = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: reviewerId,
        },
      },
    });

    if (!submission || submission.finalScore === null) continue;

    const totalPenalty = incompleteCount * penalty;
    const newScore = Math.max(0, submission.finalScore - totalPenalty);

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        finalScore: Math.round(newScore * 100) / 100,
      },
    });
  }
}

export function isAnomalousScore(score: number, allScores: number[]): boolean {
  if (allScores.length < 2) return false;

  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance =
    allScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / allScores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return false;

  const zScore = Math.abs((score - mean) / stdDev);
  return zScore > 2;
}
