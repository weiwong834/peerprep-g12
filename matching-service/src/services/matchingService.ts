import type { Server, Socket } from 'socket.io';
import {
	ActionFlowStatus,
	DifficultyLevel,
	MatchResponseStatus,
	ProgrammingLanguage,
	WebSocketEventType,
	type CancelRequestPayload,
	type CandidateMatch,
	type ConfirmRequestPayload,
	type MatchRequestPayload,
	type MatchResponsePayload
} from '../types/matchingEvents.js';
import { RedisService } from './redisService.js';
import { QuestionService } from './questionService.js';
import { createLogger } from '../utils/logger.js';
import type { CreateSessionDTO, Session } from '../models/dto.js';

const PERFECT_MATCH_TIMEOUT_MS = 30_000;
const IMPERFECT_CONFIRMATION_TIMEOUT_MS = 30_000;
const DIFFICULTY_RANK: Record<DifficultyLevel, number> = {
	[DifficultyLevel.EASY]: 1,
	[DifficultyLevel.MEDIUM]: 2,
	[DifficultyLevel.HARD]: 3
};

interface ActiveMatchContext {
	socketId: string;
	userId: string;
	perfectMatchTimer?: NodeJS.Timeout;
	confirmationTimer?: NodeJS.Timeout;
	proposedImperfectMatch?: CandidateMatch;
}

export class MatchingService {
	private activeContextsByUserId = new Map<string, ActiveMatchContext>();
	private readonly logger = createLogger('MatchingService');

	constructor(
		private readonly io: Server,
		private readonly redisService: RedisService,
		private readonly questionService: QuestionService,
		private readonly collaborationServiceBaseUrl: string
	) {}

	async handleMatchRequest(socket: Socket, payload: MatchRequestPayload): Promise<void> {
		const { userId, criteria } = payload;
		this.logger.info('Handling match request', { userId, socketId: socket.id, criteria });

		// Validate difficulty and language
		const validDifficulties = Object.values(DifficultyLevel);
		const validLanguages = Object.values(ProgrammingLanguage);

		if (!validDifficulties.includes(criteria.difficulty)) {
			this.logger.warn('Rejected match request: invalid difficulty', {
				userId,
				difficulty: criteria.difficulty
			});
            socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'Invalid difficulty level.'
			});
			return;
		}

		if (!validLanguages.includes(criteria.language)) {
			this.logger.warn('Rejected match request: invalid language', {
				userId,
				language: criteria.language
			});
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'Invalid programming language.'
			});
			return;
		}

		// Validate topic against Question Service
		const isValidTopic = await this.questionService.validateTopic(criteria.topic);

		if (!isValidTopic) {
			this.logger.warn('Rejected match request: invalid topic', {
				userId,
				topic: criteria.topic
			});
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'Invalid topic.'
			});
			return;
		}

		this.setOrResetContext(socket.id, userId);
		await this.redisService.enqueueUser(userId, criteria);
		this.logger.info('User enqueued for matching', { userId, topic: criteria.topic });

        // Tells frontend user is now queued
		socket.emit(WebSocketEventType.MATCH_RESPONSE, {
			status: MatchResponseStatus.QUEUED,
			flowStatus: ActionFlowStatus.WAITING_PERFECT_MATCH,
			timeoutSeconds: PERFECT_MATCH_TIMEOUT_MS / 1000,
			message: 'Searching for a perfect match.'
		});

        // Starts 30 second timer
		this.startPerfectMatchTimer(socket, userId);

		// Placeholder: Replace this with a loop based matching logic.
		const candidate = await this.redisService.findBestCandidate(userId);
		if (!candidate) {
			this.logger.debug('No match found yet', { userId });
			return;
		}
		this.logger.info('Match found', {
			userId,
			candidateUserA: candidate.userAId,
			candidateUserB: candidate.userBId,
			isPerfect: candidate.isPerfect
		});

		const context = this.activeContextsByUserId.get(userId);
		if (context?.perfectMatchTimer) {
			clearTimeout(context.perfectMatchTimer);
		}

		if (candidate.isPerfect) {
			this.logger.info('Proceeding with perfect match', {
				userAId: candidate.userAId,
				userBId: candidate.userBId
			});
			await this.completePerfectMatch(socket, candidate);
			return;
		}
		this.logger.info('Proceeding with imperfect match confirmation', {
			userAId: candidate.userAId,
			userBId: candidate.userBId
		});

		await this.startImperfectMatchConfirmation(candidate);
	}

	async handleCancelRequest(socket: Socket, payload: CancelRequestPayload): Promise<void> {
		const { userId } = payload;
		this.logger.info('Handling cancel request', { userId, socketId: socket.id });
		const context = this.activeContextsByUserId.get(userId);

		if (context?.perfectMatchTimer) {
			clearTimeout(context.perfectMatchTimer);
		}
		if (context?.confirmationTimer) {
			clearTimeout(context.confirmationTimer);
		}

		await this.redisService.removeUserFromQueue(userId);

		if (context?.proposedImperfectMatch) {
			await this.redisService.clearPendingConfirmation(context.proposedImperfectMatch);
		}

		this.activeContextsByUserId.delete(userId);
		this.logger.info('Cancellation cleanup completed', { userId });
		socket.emit(WebSocketEventType.CANCEL_RESPONSE, {
			status: MatchResponseStatus.CANCELLED,
			flowStatus: ActionFlowStatus.TERMINATED,
			message: 'Matching cancelled by user.'
		});
	}

	async handleConfirmRequest(socket: Socket, payload: ConfirmRequestPayload): Promise<void> {
		const { userId, accepted } = payload;
		this.logger.info('Handling confirm request', { userId, accepted, socketId: socket.id });
		const context = this.activeContextsByUserId.get(userId);
		if (!context?.proposedImperfectMatch) {
			this.logger.warn('Ignoring confirm request: no pending imperfect match context', { userId });
			return;
		}

		if (!accepted) {
			this.logger.info('User declined imperfect match', {
				userId,
				userAId: context.proposedImperfectMatch.userAId,
				userBId: context.proposedImperfectMatch.userBId
			});
			await this.failImperfectMatch(context.proposedImperfectMatch, 'One user declined imperfect match.');
			return;
		}

		await this.redisService.setUserConfirmation(userId, accepted);
		const pending = await this.redisService.getPendingConfirmationByUser(userId);

		if (!pending) {
			this.logger.warn('Pending confirmation state not found for user', { userId });
			return;
		}

		const allConfirmed =
			pending.acceptedUserIds.has(pending.proposedMatch.userAId) &&
			pending.acceptedUserIds.has(pending.proposedMatch.userBId);

		if (!allConfirmed) {
			this.logger.debug('Waiting for the other user confirmation', {
				userId,
				userAId: pending.proposedMatch.userAId,
				userBId: pending.proposedMatch.userBId
			});
			return;
		}
		this.logger.info('Both users confirmed imperfect match', {
			userAId: pending.proposedMatch.userAId,
			userBId: pending.proposedMatch.userBId
		});

		await this.finalizeConfirmedImperfectMatch(pending.proposedMatch);
		this.emitToUser(pending.proposedMatch.userAId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			message: 'Imperfect match confirmed by both users.'
		});
		this.emitToUser(pending.proposedMatch.userBId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			message: 'Imperfect match confirmed by both users.'
		});
	}

	handleSocketDisconnect(socketId: string): void {
		this.logger.info('Socket disconnect received', { socketId });
		// Placeholder: Find user that owns socket and do necessary cleanup.
        // Clear active timers and Redis state. 
        // Remove in memory context and if there is another user waiting for match, notify them.
		void socketId;
	}

    // Clears any old timers and sets new context for the user (gives them the most recent socket id)
	private setOrResetContext(socketId: string, userId: string): void {
		const current = this.activeContextsByUserId.get(userId);
		if (current?.perfectMatchTimer) {
			clearTimeout(current.perfectMatchTimer);
		}
		if (current?.confirmationTimer) {
			clearTimeout(current.confirmationTimer);
		}

		this.activeContextsByUserId.set(userId, { socketId, userId });
		this.logger.debug('Active context set or reset', { userId, socketId });
	}

	private startPerfectMatchTimer(socket: Socket, userId: string): void {
		const context = this.activeContextsByUserId.get(userId);
		if (!context) {
			return;
		}

        // If 30 seconds runs out, remove user from queue, delete user context, and notify frontend
		context.perfectMatchTimer = setTimeout(async () => {
			this.logger.info('Perfect match timer expired', { userId, timeoutMs: PERFECT_MATCH_TIMEOUT_MS });
			await this.redisService.removeUserFromQueue(userId);
			this.activeContextsByUserId.delete(userId);
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'No match found within 30 seconds.'
			});
		}, PERFECT_MATCH_TIMEOUT_MS);
	}

	private async completePerfectMatch(socket: Socket, candidate: CandidateMatch): Promise<void> {
		this.logger.info('Creating collaboration room for perfect match', {
			userAId: candidate.userAId,
			userBId: candidate.userBId
		});
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);
		const sessionId = await this.createCollaborationRoom(candidate);

        // Informs frontend: perfect match found, creating collab room, here is the sessionId
		socket.emit(WebSocketEventType.MATCH_RESPONSE, {
			status: MatchResponseStatus.PERFECT_MATCH_FOUND,
			flowStatus: ActionFlowStatus.CREATING_COLLABORATION_ROOM,
			sessionId,
			message: 'Perfect match found.'
		});

        // Informs both users' frontend: the match is successful
		this.emitToUser(candidate.userAId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			sessionId,
			message: 'Perfect match successful.'
		});
		this.emitToUser(candidate.userBId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			sessionId,
			message: 'Perfect match successful.'
		});

		this.clearUserContext(candidate.userAId);
		this.clearUserContext(candidate.userBId);
		this.logger.info('Perfect match completed', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			sessionId
		});
	}

	private async startImperfectMatchConfirmation(candidate: CandidateMatch): Promise<void> {
		const contextA = this.activeContextsByUserId.get(candidate.userAId);
		const contextB = this.activeContextsByUserId.get(candidate.userBId);
		if (!contextA || !contextB) {
			this.logger.warn('Unable to start imperfect confirmation: user context missing', {
				userAId: candidate.userAId,
				userBId: candidate.userBId,
				hasContextA: Boolean(contextA),
				hasContextB: Boolean(contextB)
			});
			return;
		}

		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);

		const resolvedCandidate = this.resolveImperfectMatchCriteria(candidate);
		this.logger.info('Imperfect match resolved criteria ready', {
			userAId: resolvedCandidate.userAId,
			userBId: resolvedCandidate.userBId,
			resolvedCriteria: resolvedCandidate.resolvedCriteria
		});
		contextA.proposedImperfectMatch = resolvedCandidate;
		contextB.proposedImperfectMatch = resolvedCandidate;
		await this.redisService.savePendingConfirmation(resolvedCandidate);

		const confirmationPayload: MatchResponsePayload = {
			status: MatchResponseStatus.IMPERFECT_MATCH_NEEDS_CONFIRMATION,
			flowStatus: ActionFlowStatus.WAITING_IMPERFECT_CONFIRMATION,
			timeoutSeconds: IMPERFECT_CONFIRMATION_TIMEOUT_MS / 1000,
			proposedMatch: resolvedCandidate,
			message: 'Imperfect match proposed. Waiting for both confirmations.'
		};
		// Notify both users of proposed imperfect match
		this.emitToUser(candidate.userAId, confirmationPayload);
		this.emitToUser(candidate.userBId, confirmationPayload);

		const confirmationTimer = setTimeout(async () => {
			this.logger.info('Imperfect confirmation timer expired', {
				userAId: resolvedCandidate.userAId,
				userBId: resolvedCandidate.userBId,
				timeoutMs: IMPERFECT_CONFIRMATION_TIMEOUT_MS
			});
			await this.failImperfectMatch(resolvedCandidate, 'Confirmation window expired.');
		}, IMPERFECT_CONFIRMATION_TIMEOUT_MS);

		contextA.confirmationTimer = confirmationTimer;
		contextB.confirmationTimer = confirmationTimer;
	}

	private resolveImperfectMatchCriteria(candidate: CandidateMatch): CandidateMatch {
		const longerWaitingUserId = this.getLongerWaitingUserId(candidate);
		const lowerDifficulty = this.getLowerDifficulty(candidate.criteriaA.difficulty, candidate.criteriaB.difficulty);
		const resolvedLanguage =
			longerWaitingUserId === candidate.userAId
				? candidate.criteriaA.language
				: candidate.criteriaB.language;

		const resolvedTopic =
			longerWaitingUserId === candidate.userAId ? candidate.criteriaA.topic : candidate.criteriaB.topic;

		return {
			...candidate,
			resolvedCriteria: {
				topic: resolvedTopic,
				difficulty: lowerDifficulty,
				language: resolvedLanguage
			}
		};
	}

    // Get the user who has a longer waiting time
	private getLongerWaitingUserId(candidate: CandidateMatch): string {
		if (
			typeof candidate.queuedAtUserA === 'number' &&
			typeof candidate.queuedAtUserB === 'number'
		) {
			return candidate.queuedAtUserA <= candidate.queuedAtUserB ? candidate.userAId : candidate.userBId;
		}

		// Placeholder until Redis set up.
		return candidate.userAId;
	}

	private getLowerDifficulty(a: DifficultyLevel, b: DifficultyLevel): DifficultyLevel {
		return DIFFICULTY_RANK[a] <= DIFFICULTY_RANK[b] ? a : b;
	}

	private async failImperfectMatch(candidate: CandidateMatch, reason: string): Promise<void> {
		this.logger.info('Failing imperfect match', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			reason
		});
		await this.redisService.clearPendingConfirmation(candidate);
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);

		this.emitToUser(candidate.userAId, {
			status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
			flowStatus: ActionFlowStatus.TERMINATED,
			message: reason
		});
		this.emitToUser(candidate.userBId, {
			status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
			flowStatus: ActionFlowStatus.TERMINATED,
			message: reason
		});

		this.clearUserContext(candidate.userAId);
		this.clearUserContext(candidate.userBId);
	}

	private async finalizeConfirmedImperfectMatch(candidate: CandidateMatch): Promise<void> {
		this.logger.info('Creating collaboration room for confirmed imperfect match', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			resolvedCriteria: candidate.resolvedCriteria
		});
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);
		const sessionId = await this.createCollaborationRoom(candidate);
		await this.redisService.clearPendingConfirmation(candidate);

		this.emitToUser(candidate.userAId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			sessionId,
			message: 'Imperfect match confirmed and room created.'
		});
		this.emitToUser(candidate.userBId, {
			status: MatchResponseStatus.MATCH_SUCCESS,
			flowStatus: ActionFlowStatus.COMPLETED,
			sessionId,
			message: 'Imperfect match confirmed and room created.'
		});

		this.clearUserContext(candidate.userAId);
		this.clearUserContext(candidate.userBId);
		this.logger.info('Imperfect match finalized', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			sessionId
		});
	}

	private async createCollaborationRoom(candidate: CandidateMatch): Promise<string> {
		const finalCriteria = candidate.resolvedCriteria ?? candidate.criteriaA;
		this.logger.info('Calling collaboration service to create room', {
			url: `${this.collaborationServiceBaseUrl}/sessions`,
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			resolvedCriteria: finalCriteria
		});

        const createSessionDTO: CreateSessionDTO = {
            user1_id: candidate.userAId,
            user2_id: candidate.userBId,
	        language: finalCriteria.language,
	        difficulty: finalCriteria.difficulty,
	        topic: finalCriteria.topic
        }

		const response = await fetch(`${this.collaborationServiceBaseUrl}/sessions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(createSessionDTO)
		});

		const body = (await response.json()) as Session | { session: Session; error?: string } | { error: string };

		if (!response.ok) {
			this.logger.error('Collaboration service returned non-2xx response', {
				status: response.status,
				body
			});
			throw new Error(`Failed to create collaboration room: ${response.status}`);
		}

		const session = 'session_id' in body ? body : 'session' in body ? body.session : undefined;
		if (!session?.session_id) {
			this.logger.error('Collaboration service response missing session_id', {
				status: response.status,
				body
			});
			throw new Error('Invalid collaboration service response: missing session_id');
		}

		this.logger.info('Collaboration service response received', {
			status: response.status,
			sessionId: session.session_id
		});
		return session.session_id;
	}

	private emitToUser(userId: string, payload: MatchResponsePayload): void {
		const context = this.activeContextsByUserId.get(userId);
		if (!context) {
			return;
		}

		this.io.to(context.socketId).emit(WebSocketEventType.MATCH_RESPONSE, payload);
	}

	private clearUserTimers(userId: string): void {
		const context = this.activeContextsByUserId.get(userId);
		if (!context) {
			return;
		}

		if (context.perfectMatchTimer) {
			clearTimeout(context.perfectMatchTimer);
		}
		if (context.confirmationTimer) {
			clearTimeout(context.confirmationTimer);
		}
	}

	private clearUserContext(userId: string): void {
		this.clearUserTimers(userId);
		this.activeContextsByUserId.delete(userId);
	}
}
