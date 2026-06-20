import prisma from '../prisma';

export type AssignmentStatus = 'DRAFT' | 'SUBMISSION' | 'PEER_REVIEW' | 'GRADING' | 'COMPLETED' | 'REOPENED';

export function getAssignmentStatus(assignment: {
  submissionDeadline: Date;
  reviewDeadline: Date;
  status: string;
}): string {
  if (assignment.status === 'DRAFT' || assignment.status === 'REOPENED') {
    return assignment.status;
  }

  const now = new Date();

  if (now < assignment.submissionDeadline) {
    return 'SUBMISSION';
  }

  if (now < assignment.reviewDeadline) {
    return 'PEER_REVIEW';
  }

  if (assignment.status === 'GRADING') {
    return 'GRADING';
  }

  return 'COMPLETED';
}

export async function updateAssignmentStatus(assignmentId: string): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) return;

  const newStatus = getAssignmentStatus(assignment);

  if (newStatus !== assignment.status && assignment.status !== 'DRAFT' && assignment.status !== 'REOPENED') {
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: newStatus },
    });
  }
}

export async function calculateLateMinutes(
  submissionDeadline: Date,
  submittedAt: Date
): Promise<number> {
  const diffMs = submittedAt.getTime() - submissionDeadline.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60));
}
