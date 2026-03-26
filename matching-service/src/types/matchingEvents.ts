export enum WebSocketEventType {
  MATCH_REQUEST = 'match_request',
  MATCH_RESPONSE = 'match_response',
  CANCEL_REQUEST = 'cancel_request',
  CANCEL_RESPONSE = 'cancel_response',
  CONFIRM_REQUEST = 'confirm_request'
}

export enum MatchResponseStatus {
  QUEUED = 'queued',
  PERFECT_MATCH_FOUND = 'perfect_match_found',
  IMPERFECT_MATCH_NEEDS_CONFIRMATION = 'imperfect_match_needs_confirmation',
  MATCH_SUCCESS = 'match_success',
  MATCH_TIMEOUT = 'match_timeout',
  CANCELLED = 'cancelled',
  UNSUCCESSFUL_MATCH = 'unsuccessful_match'
}

export enum ActionFlowStatus {
  IDLE = 'idle',
  WAITING_PERFECT_MATCH = 'waiting_perfect_match',
  WAITING_IMPERFECT_CONFIRMATION = 'waiting_imperfect_confirmation',
  CREATING_COLLABORATION_ROOM = 'creating_collaboration_room',
  COMPLETED = 'completed',
  TERMINATED = 'terminated'
}

// Temporary for testing, to connect with question service later
export enum Topic {
    ARRAYS = 'arrays',
    SORTING = 'sorting',
    STRINGS = 'strings',
    HASH_TABLES = 'hash_tables',
    LINKED_LISTS = 'linked_lists',
    RECURSION = 'recursion',
    TREES = 'trees',
    GRAPHS = 'graphs',
    HEAPS = 'heaps',
    TRIES = 'tries',
}

export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export enum ProgrammingLanguage {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java'
}
export interface MatchCriteria {
  topic: Topic;
  difficulty: DifficultyLevel;
  language: ProgrammingLanguage;
}

export interface MatchRequestPayload {
  userId: string;
  criteria: MatchCriteria;
}

export interface CandidateMatch {
  userAId: string;
  userBId: string;
  isPerfect: boolean;
  criteriaA: MatchCriteria;
  criteriaB: MatchCriteria;
  queuedAtUserA?: number;
  queuedAtUserB?: number;
  resolvedCriteria?: MatchCriteria;
}

export interface MatchResponsePayload {
  status: MatchResponseStatus;
  flowStatus: ActionFlowStatus;
  roomId?: string;
  timeoutSeconds?: number;
  message?: string;
  proposedMatch?: CandidateMatch;
}

export interface CancelRequestPayload {
  userId: string;
}

export interface CancelResponsePayload {
  status: MatchResponseStatus;
  flowStatus: ActionFlowStatus;
  message: string;
}

export interface ConfirmRequestPayload {
  userId: string;
  accepted: boolean;
}
