export type UserRole = 'STUDENT' | 'TEACHER' | 'TA';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  createdAt?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  teacherId: string;
  teacher?: User;
  role?: UserRole;
  memberCount?: number;
  assignmentCount?: number;
  createdAt: string;
  userRole?: UserRole;
}

export type AssignmentStatus =
  | 'DRAFT'
  | 'SUBMISSION'
  | 'PEER_REVIEW'
  | 'GRADING'
  | 'COMPLETED'
  | 'REOPENED';

export type LateDeductionType = 'NONE' | 'FIXED' | 'PER_DAY' | 'PER_HOUR';

export interface RubricCriterion {
  id: string;
  assignmentId: string;
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
  order: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  status: AssignmentStatus;
  currentStatus: AssignmentStatus;
  submissionDeadline: string;
  reviewDeadline: string;
  reviewsPerSubmission: number;
  anonymousReview: boolean;
  dropHighestLowest: boolean;
  lateDeductionType: LateDeductionType;
  lateDeductionValue: number;
  lateDeductionMax: number;
  incompleteReviewPenalty: number;
  maxScore: number;
  rubric?: RubricCriterion[];
  userSubmission?: Submission | null;
  userReviewCount?: number;
  createdAt: string;
}

export type SubmissionStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'LATE'
  | 'NOT_SUBMITTED_LATE';

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content?: string;
  attachmentUrl?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  lateMinutes: number;
  finalScore?: number;
  rawScore?: number;
  isLocked: boolean;
  createdAt: string;
  student?: User;
  reviews?: Review[];
  appeal?: Appeal;
}

export type ReviewStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ReviewCriterionScore {
  id: string;
  reviewId: string;
  criterionId: string;
  score: number;
  comment?: string;
}

export interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  status: ReviewStatus;
  overallScore?: number;
  overallComment?: string;
  completedAt?: string;
  createdAt: string;
  submission?: Submission;
  reviewer?: User;
  criterionScores: ReviewCriterionScore[];
}

export type AppealStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface Appeal {
  id: string;
  submissionId: string;
  assignmentId: string;
  appellantId: string;
  status: AppealStatus;
  reason: string;
  taReviewerId?: string;
  taScore?: number;
  taComment?: string;
  finalScore?: number;
  reviewedAt?: string;
  createdAt: string;
  appellant?: User;
  assignment?: Assignment;
  submission?: Submission;
  taReviewer?: User;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ip?: string;
  createdAt: string;
  user?: User;
}
