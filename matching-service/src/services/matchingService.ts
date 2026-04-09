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
const MAX_TOTAL_QUEUE_TIME_MS = 120_000;
const DIFFICULTY_RANK: Record<DifficultyLevel, number> = {
	[DifficultyLevel.EASY]: 1,
	[DifficultyLevel.MEDIUM]: 2,
	[DifficultyLevel.HARD]: 3
};

interface ActiveMatchContext {
	socketId: string;
	userId: string;
	queuedSince: number;
	perfectMatchTimer?: NodeJS.Timeout;
	confirmationTimer?: NodeJS.Timeout;
	proposedImperfectMatch?: CandidateMatch;
}

export type EarlyTerminationOutcome = 'strike_recorded' | 'ban_triggered' | 'already_banned';
export type EarlyTerminationDecision = {
	outcome: EarlyTerminationOutcome;
	strikeCount?: number;
};

type ActiveSessionCheckOutcome = 'active' | 'inactive' | 'error';

export class MatchingService {
	private activeContextsByUserId = new Map<string, ActiveMatchContext>();
	private activeUserIdBySocketId = new Map<string, string>();
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

		if (await this.redisService.isUserBanned(userId)) {
			this.logger.warn('Rejected match request: user is banned', { userId });
			this.clearUserContext(userId);
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'You are temporarily banned from matching.'
			});
			return;
		}

		// Check with collaboration service if user has existing active session before allowing match request
		const activeSessionOutcome = await this.checkActiveSessionByUserIdInternal(userId);
		if (activeSessionOutcome === 'active') {
			this.logger.warn('Rejected match request: user is already in an active collaboration session', {
				userId
			});
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'You are already in an active collaboration session.'
			});
			return;
		}

		if (activeSessionOutcome === 'error') {
			socket.emit(WebSocketEventType.MATCH_RESPONSE, {
				status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'Unable to verify active session status due to an internal error. Please try again.'
			});
			return;
		}

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

		this.setOrResetContext(socket.id, userId, Date.now());
		await this.redisService.enqueueUser(userId, criteria);
		this.logger.info('User enqueued for matching', { userId, topic: criteria.topic });

		const timeoutSeconds = this.startPerfectMatchTimer(userId);

        // Tells frontend user is now queued
		socket.emit(WebSocketEventType.MATCH_RESPONSE, {
			status: MatchResponseStatus.QUEUED,
			flowStatus: ActionFlowStatus.WAITING_PERFECT_MATCH,
			timeoutSeconds,
			message: 'Searching for a perfect match.'
		});

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

	private async checkActiveSessionByUserIdInternal(userId: string): Promise<ActiveSessionCheckOutcome> {
		const apiKey = process.env.INTERNAL_SERVICE_SECRET;
		if (!apiKey) {
			this.logger.error('INTERNAL_SERVICE_SECRET is not set in matching service environment');
			return 'error';
		}

		try {
			const response = await fetch(
				`${this.collaborationServiceBaseUrl}/sessions/internal/active/${encodeURIComponent(userId)}`,
				{
					method: 'GET',
					headers: {
						'x-internal-service-secret': apiKey
					}
				}
			);

			if (response.status === 200) {
				return 'active';
			}

			if (response.status === 404) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				if (body?.error === 'No active session found') {
					return 'inactive';
				}
			}

			this.logger.error('Unexpected response while checking for active collaboration session', {
				userId,
				status: response.status
			});
			return 'error';
		} catch (error) {
			this.logger.error('Failed to call collaboration service active session endpoint', {
				userId,
				error: error instanceof Error ? error.message : String(error)
			});
			return 'error';
		}
	}

	async handleCancelRequest(socket: Socket, payload: CancelRequestPayload): Promise<void> {
		const { userId } = payload;
		this.logger.info('Handling cancel request', { userId, socketId: socket.id });
		const isQueued = await this.redisService.isUserQueued(userId);
		const hasPendingConfirmation = await this.redisService.hasPendingConfirmationState(userId);

		if (!isQueued || hasPendingConfirmation) {
			this.logger.warn('Cancel request rejected due to invalid state', {
				userId,
				isQueued,
				hasPendingConfirmation
			});
			socket.emit(WebSocketEventType.CANCEL_RESPONSE, {
				status: hasPendingConfirmation 
					? MatchResponseStatus.IMPERFECT_MATCH_NEEDS_CONFIRMATION 
					: MatchResponseStatus.UNSUCCESSFUL_MATCH,
				flowStatus: hasPendingConfirmation
					? ActionFlowStatus.WAITING_IMPERFECT_CONFIRMATION
					: ActionFlowStatus.TERMINATED,
				message: hasPendingConfirmation
					? 'Cannot cancel while an imperfect match confirmation is pending.'
					: 'Cannot cancel because user is not currently queued.'
			});
			return;
		}

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

		this.clearUserContext(userId);
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
			await this.failImperfectMatch(
				context.proposedImperfectMatch,
				'One user declined imperfect match.',
				{ requeueEligible: true, recordRejection: true }
			);
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

	async handleSocketDisconnect(socketId: string): Promise<void> {
		this.logger.info('Socket disconnect received', { socketId });

		// Identify disconnect user by socket id
		const disconnectedUserId = this.activeUserIdBySocketId.get(socketId);
		if (!disconnectedUserId) {
			this.logger.info('No active matching context found for disconnected socket', { socketId });
			return;
		}

		// Check if user was pending imperfect match confirmation
		const pending = await this.redisService.getPendingConfirmationByUser(disconnectedUserId);

		// If user was in pending imperfect match confirmation, fail match and notify the other user
		if (pending?.proposedMatch) {
			await this.failImperfectMatch(
				pending.proposedMatch,
				'Match cancelled because the other user disconnected.',
				{ requeueEligible: false, recordRejection: false }
			);
			this.logger.info('Disconnect cleanup completed for pending imperfect confirmation', {
				socketId,
				disconnectedUserId,
				userAId: pending.proposedMatch.userAId,
				userBId: pending.proposedMatch.userBId
			});
			return;
		}

		await this.redisService.removeUserFromQueue(disconnectedUserId);
		this.clearUserContext(disconnectedUserId);
		this.logger.info('Disconnect cleanup completed for queued user', {
			socketId,
			disconnectedUserId
		});
	}

	async handleEarlyTermination(userId: string): Promise<EarlyTerminationDecision> {
		this.logger.info('Handling early termination report', { userId });

		const decision = await this.redisService.recordEarlyTermination(userId);
		if (decision.outcome === 'ban_triggered') {
			await this.handleExternalBan(userId);
		}

		return decision;
	}

	// Handles the case when a user is banned while pending imperfect match confirmation
	async handleExternalBan(userId: string): Promise<void> {
		this.logger.info('Handling external ban signal', { userId });

		const pending = await this.redisService.getPendingConfirmationByUser(userId);
		if (!pending?.proposedMatch) {
			await this.redisService.removeUserFromQueue(userId);
			// Notify the banned user immediately
			this.emitToUser(userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'You are temporarily banned from matching.'
			});
			this.clearUserContext(userId);
			return;
		}

		// Checks if banned user was currently pending imperfect match confirmation
		const candidate = pending.proposedMatch;
		const otherUserId = candidate.userAId === userId ? candidate.userBId : candidate.userAId;
		const otherCriteria = otherUserId === candidate.userAId ? candidate.criteriaA : candidate.criteriaB;
		const otherQueuedAt = otherUserId === candidate.userAId
			? candidate.queuedAtUserA ?? Date.now()
			: candidate.queuedAtUserB ?? Date.now();

		// Clear the pending imperfect match confirmation
		await this.redisService.clearPendingConfirmation(candidate);
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);

		// Tell banned user they are banned
		this.emitToUser(userId, {
			status: MatchResponseStatus.MATCH_TIMEOUT,
			flowStatus: ActionFlowStatus.TERMINATED,
			message: 'You are temporarily banned from matching.'
		});
		this.clearUserContext(userId);

		// Tell other user the match failed and requeue them if eligible
		await this.requeueUserAfterImperfectFailure({
			userId: otherUserId,
			criteria: otherCriteria,
			queuedAt: otherQueuedAt,
			rejectedCandidates: otherCriteria.rejectedCandidates ?? [],
			reason: 'The other user was removed during confirmation.'
		});
	}

    // Clears any old timers and sets new context for the user (gives them the most recent socket id)
	private setOrResetContext(socketId: string, userId: string, queuedSince: number): void {
		const mappedUserId = this.activeUserIdBySocketId.get(socketId);
		if (mappedUserId && mappedUserId !== userId) {
			this.clearUserContext(mappedUserId);
		}

		const current = this.activeContextsByUserId.get(userId);
		if (current?.socketId && current.socketId !== socketId) {
			this.activeUserIdBySocketId.delete(current.socketId);
		}
		if (current?.perfectMatchTimer) {
			clearTimeout(current.perfectMatchTimer);
		}
		if (current?.confirmationTimer) {
			clearTimeout(current.confirmationTimer);
		}

		this.activeContextsByUserId.set(userId, { socketId, userId, queuedSince });
		this.activeUserIdBySocketId.set(socketId, userId);
		this.logger.debug('Active context set or reset', { userId, socketId });
	}

	private startPerfectMatchTimer(userId: string): number {
		const context = this.activeContextsByUserId.get(userId);
		if (!context) {
			return 0;
		}

		const elapsedMs = Date.now() - context.queuedSince;
		const remainingTotalMs = MAX_TOTAL_QUEUE_TIME_MS - elapsedMs;
		if (remainingTotalMs <= 0) {
			void this.redisService.removeUserFromQueue(userId);
			this.emitToUser(userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'No match found within 2 minutes.'
			});
			this.clearUserContext(userId);
			return 0;
		}

		const timeoutMs = Math.min(PERFECT_MATCH_TIMEOUT_MS, remainingTotalMs);

		// If the attempt timeout runs out, remove user from queue, delete user context, and notify frontend
		context.perfectMatchTimer = setTimeout(async () => {
			this.logger.info('Perfect match timer expired', { userId, timeoutMs });
			await this.redisService.removeUserFromQueue(userId);
			this.emitToUser(userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: timeoutMs < PERFECT_MATCH_TIMEOUT_MS
					? 'No match found within 2 minutes.'
					: 'No match found within 30 seconds.'
			});
			this.clearUserContext(userId);
		}, timeoutMs);

		return Math.ceil(timeoutMs / 1000);
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
			await this.expireImperfectMatchConfirmation(resolvedCandidate, 'Confirmation window expired.');
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

	private getUpdatedRejectedCandidates(
		existing: string[] | undefined,
		recordRejection: boolean,
		rejectedUserId: string
	): string[] {
		const normalized = Array.isArray(existing) ? existing : [];
		if (!recordRejection) {
			return normalized;
		}

		return Array.from(new Set([...normalized, rejectedUserId]));
	}

	private async requeueUserAfterImperfectFailure(params: {
		userId: string;
		criteria: CandidateMatch['criteriaA'];
		queuedAt: number;
		rejectedCandidates: string[];
		reason: string;
	}): Promise<void> {
		const context = this.activeContextsByUserId.get(params.userId);
		if (!context) {
			return;
		}

		if (await this.redisService.isUserBanned(params.userId)) {
			this.logger.info('Skipping requeue because user is banned', {
				userId: params.userId,
				reason: params.reason
			});
			this.emitToUser(params.userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'You are temporarily banned from matching.'
			});
			this.clearUserContext(params.userId);
			return;
		}

		const elapsedMs = Date.now() - context.queuedSince;
		if (elapsedMs >= MAX_TOTAL_QUEUE_TIME_MS) {
			this.emitToUser(params.userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: 'Stopped queueing after 2 minutes without a successful match.'
			});
			this.clearUserContext(params.userId);
			return;
		}

		await this.redisService.requeueUserWithSameWaitingTime(
			params.userId,
			params.criteria,
			params.queuedAt,
			params.rejectedCandidates
		);

		delete context.proposedImperfectMatch;
		delete context.confirmationTimer;
		const timeoutSeconds = this.startPerfectMatchTimer(params.userId);
		this.emitToUser(params.userId, {
			status: MatchResponseStatus.QUEUED,
			flowStatus: ActionFlowStatus.WAITING_PERFECT_MATCH,
			timeoutSeconds,
			message: `${params.reason} Continuing to search for another match.`
		});
	}

	private async failImperfectMatch(
		candidate: CandidateMatch,
		reason: string,
		options: { requeueEligible: boolean; recordRejection: boolean }
	): Promise<void> {
		this.logger.info('Failing imperfect match', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			reason,
			...options
		});
		await this.redisService.clearPendingConfirmation(candidate);
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);

		if (options.requeueEligible) {
			await this.requeueUserAfterImperfectFailure({
				userId: candidate.userAId,
				criteria: candidate.criteriaA,
				queuedAt: candidate.queuedAtUserA ?? Date.now(),
				rejectedCandidates: this.getUpdatedRejectedCandidates(
					candidate.criteriaA.rejectedCandidates,
					options.recordRejection,
					candidate.userBId
				),
				reason
			});
			await this.requeueUserAfterImperfectFailure({
				userId: candidate.userBId,
				criteria: candidate.criteriaB,
				queuedAt: candidate.queuedAtUserB ?? Date.now(),
				rejectedCandidates: this.getUpdatedRejectedCandidates(
					candidate.criteriaB.rejectedCandidates,
					options.recordRejection,
					candidate.userAId
				),
				reason
			});
			return;
		}

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

	private async expireImperfectMatchConfirmation(candidate: CandidateMatch, reason: string): Promise<void> {
		this.logger.info('Expiring imperfect match confirmation', {
			userAId: candidate.userAId,
			userBId: candidate.userBId,
			reason
		});

		const pending =
			(await this.redisService.getPendingConfirmationByUser(candidate.userAId)) ??
			(await this.redisService.getPendingConfirmationByUser(candidate.userBId));
		if (!pending) {
			this.logger.warn('Pending confirmation state not found while expiring imperfect match', {
				userAId: candidate.userAId,
				userBId: candidate.userBId
			});
			return;
		}

		// Check in case both users confirmed while the timer callback was waiting to execute
		if (
			pending.acceptedUserIds.has(candidate.userAId) &&
			pending.acceptedUserIds.has(candidate.userBId)
		) {
			this.logger.debug('Ignoring confirmation timeout because both users already confirmed', {
				userAId: candidate.userAId,
				userBId: candidate.userBId
			});
			return;
		}

		await this.redisService.clearPendingConfirmation(candidate);
		this.clearUserTimers(candidate.userAId);
		this.clearUserTimers(candidate.userBId);

		const confirmedUserIds = [candidate.userAId, candidate.userBId].filter((userId) =>
			pending.acceptedUserIds.has(userId)
		);
		
		const timedOutUserIds = [candidate.userAId, candidate.userBId].filter(
			(userId) => !pending.acceptedUserIds.has(userId)
		);

		for (const userId of confirmedUserIds) {
			const criteria = userId === candidate.userAId ? candidate.criteriaA : candidate.criteriaB;
			const queuedAt = userId === candidate.userAId ? candidate.queuedAtUserA ?? Date.now() : candidate.queuedAtUserB ?? Date.now();
			await this.requeueUserAfterImperfectFailure({
				userId,
				criteria,
				queuedAt,
				rejectedCandidates: criteria.rejectedCandidates ?? [],
				reason
			});
		}

		for (const userId of timedOutUserIds) {
			this.emitToUser(userId, {
				status: MatchResponseStatus.MATCH_TIMEOUT,
				flowStatus: ActionFlowStatus.TERMINATED,
				message: reason
			});
			this.clearUserContext(userId);
		}
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
		const context = this.activeContextsByUserId.get(userId);
		this.clearUserTimers(userId);
		this.activeContextsByUserId.delete(userId);
		if (context?.socketId) {
			this.activeUserIdBySocketId.delete(context.socketId);
		}
	}
}
