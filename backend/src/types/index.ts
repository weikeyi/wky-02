export type UserRole = 'STUDENT' | 'TEACHER' | 'TA';

export type AssignmentStatus =
  | 'DRAFT'
  | 'SUBMISSION'
  | 'PEER_REVIEW'
  | 'GRADING'
  | 'COMPLETED'
  | 'REOPENED';

export type SubmissionStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'LATE'
  | 'NOT_SUBMITTED_LATE';

export type ReviewStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export type AppealStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export type LateDeductionType = 'NONE' | 'FIXED' | 'PER_DAY' | 'PER_HOUR';
