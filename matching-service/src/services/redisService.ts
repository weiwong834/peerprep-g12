import type { CandidateMatch, MatchCriteria } from '../types/matchingEvents.js';
import { createLogger } from '../utils/logger.js';
import { createClient, type RedisClientType } from 'redis';

interface PendingConfirmationState {
	proposedMatch: CandidateMatch;
	acceptedUserIds: Set<string>;
}

interface WaitingUser {
	userId: string;
	criteria: MatchCriteria;
	queuedAt: number;
}

interface SerializedPendingConfirmationState {
	proposedMatch: CandidateMatch;
	acceptedUserIds: string[];
}

export class RedisService {
	private readonly logger = createLogger('RedisService');
	private readonly client: RedisClientType;
	private readonly keyPrefix = 'matching';
	private readonly difficultyRank: Record<MatchCriteria['difficulty'], number> = {
		easy: 1,
		medium: 2,
		hard: 3
	};

	constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

		this.client.on('error', (err) => this.logger.error('Redis client error', { error: err.message }));
        this.client.on('ready', () => this.logger.info('Redis connection is ready.'));
    }
	
	async connect(): Promise<void> {
		if (!this.client.isOpen) {
			await this.client.connect();
			await this.client.ping();
			this.logger.info('Connected to Redis service');
		}
	}

	private buildWaitingUserKey(userId: string): string {
		return `${this.keyPrefix}:waiting:user:${userId}`;
	}

	private buildTopicQueueKey(criteria: MatchCriteria): string {
		return `${this.keyPrefix}:queue:topic:${criteria.topic}`;
	}

	// 'pending' keys refer to pending imperfect match confirmations
	private buildPendingByUserKey(userId: string): string {
		return `${this.keyPrefix}:pending:user:${userId}`;
	}

	private buildPendingStateKey(matchId: string): string {
		return `${this.keyPrefix}:pending:state:${matchId}`;
	}

	private buildPendingMatchId(match: CandidateMatch): string {
		const [a, b] = [match.userAId, match.userBId].sort();
		return `${a}:${b}`;
	}

	private parseWaitingUser(value: string | null): WaitingUser | null {
		if (!value) {
			return null;
		}

		try {
			return JSON.parse(value) as WaitingUser;
		} catch (error) {
			this.logger.error('Failed to parse waiting user payload', {
				error: error instanceof Error ? error.message : String(error),
				value
			});
			return null;
		}
	}

	private parsePendingState(value: string | null): PendingConfirmationState | null {
		if (!value) {
			return null;
		}

		try {
			const parsed = JSON.parse(value) as SerializedPendingConfirmationState;
			return {
				proposedMatch: parsed.proposedMatch,
				acceptedUserIds: new Set(parsed.acceptedUserIds)
			};
		} catch (error) {
			this.logger.error('Failed to parse pending confirmation payload', {
				error: error instanceof Error ? error.message : String(error),
				value
			});
			return null;
		}
	}

	private async savePendingState(matchId: string, state: PendingConfirmationState): Promise<void> {
		const serializable: SerializedPendingConfirmationState = {
			proposedMatch: state.proposedMatch,
			acceptedUserIds: Array.from(state.acceptedUserIds)
		};

		await this.client.set(this.buildPendingStateKey(matchId), JSON.stringify(serializable), { EX: 30 });
	}

	async enqueueUser(userId: string, criteria: MatchCriteria): Promise<void> {
		const waitingUserKey = this.buildWaitingUserKey(userId);

		// Check if user is already enqueued to prevent duplicates
		const existing = await this.client.get(waitingUserKey);
		if (existing) {
			this.logger.warn('User already queued, enqueue skipped', { userId, topic: criteria.topic });
			return;
		}

		const waitingUser: WaitingUser = {
			userId,
			criteria,
			queuedAt: Date.now()
		};

		const queueKey = this.buildTopicQueueKey(criteria);

		// Create user entry and add to topic queue concurrently
		await this.client.multi()
			.set(waitingUserKey, JSON.stringify(waitingUser))
			.zAdd(queueKey, { score: waitingUser.queuedAt, value: userId })
			.exec();
		const queueSize = await this.client.zCard(queueKey);

		this.logger.info('User enqueued', {
			userId,
			queueKey,
			queueSize,
			criteria
		});
	}

	async removeUserFromQueue(userId: string): Promise<void> {
		const waitingUserKey = this.buildWaitingUserKey(userId);
		const waitingUser = this.parseWaitingUser(await this.client.get(waitingUserKey));
		if (!waitingUser) {
			this.logger.debug('removeUserFromQueue aborted: user not found in queue', { userId });
			return;
		}

		const queueKey = this.buildTopicQueueKey(waitingUser.criteria);

		// Remove user from topic queue and delete user entry concurrently
		await this.client.multi()
			.zRem(queueKey, userId)
			.del(waitingUserKey)
			.exec();
		const remainingQueueSize = await this.client.zCard(queueKey);

		this.logger.info('User removed from queue', {
			userId,
			queueKey,
			remainingQueueSize
		});
	}

	async findBestCandidate(requestingUserId: string): Promise<CandidateMatch | null> {
		// Turn text back into WaitingUser typescript interface
		const requester = this.parseWaitingUser(await this.client.get(this.buildWaitingUserKey(requestingUserId)));
		if (!requester) {
			this.logger.debug('findBestCandidate aborted: user is not queued', { requestingUserId });
			return null;
		}

		const queueKey = this.buildTopicQueueKey(requester.criteria);

		// Fetch 50 users from queue (over-fetching to give some buffer)
		// Double check user's own id is not taken for the 20 candidate ids
		// Fetch all candidate payloads
		const queuedUserIds = await this.client.zRange(queueKey, 0, 49);
		const candidateIds = queuedUserIds.filter((userId) => userId !== requestingUserId).slice(0, 20);
		const candidatePayloads = candidateIds.length > 0
			? await this.client.mGet(candidateIds.map((id) => this.buildWaitingUserKey(id)))
			: [];
		const candidatePool = candidatePayloads
			.map((value) => this.parseWaitingUser(value))
			.filter((candidate): candidate is WaitingUser => candidate !== null);

		// Can consider using this to notify users of low activity
		if (candidatePool.length === 0) {
			const totalQueueSize = await this.client.zCard(queueKey);
			this.logger.debug('No candidate to match with yet', {
				requestingUserId,
				queueKey,
				totalQueueSize
			});
			return null;
		}
		this.logger.info('Evaluating candidate pool', {
			requestingUserId,
			queueKey,
			candidatePoolSize: candidatePool.length
		});

		let bestCandidate: WaitingUser | null = null;
		let bestScore = -1;
		// Loop through candidates and calculate compatibility score
		for (const candidate of candidatePool) {
			const score = this.calculateCompatibilityScore(requester.criteria, candidate.criteria);
			this.logger.debug('Compatibility score calculated', {
				requestingUserId,
				candidateUserId: candidate.userId,
				score,
				candidateQueuedAt: candidate.queuedAt,
				candidateCriteria: candidate.criteria
			});

			if (!bestCandidate) {
				bestCandidate = candidate;
				bestScore = score;
				continue;
			}

			// Check if candidate has a higher score, then if tie check if candidate has longer waiting time
			const hasHigherScore = score > bestScore;
			const tieButOlder = score === bestScore && candidate.queuedAt < bestCandidate.queuedAt;
			if (hasHigherScore || tieButOlder) {
				bestCandidate = candidate;
				bestScore = score;
			}
		}

		if (!bestCandidate) {
			this.logger.warn('No best candidate selected after scoring loop', { requestingUserId });
			return null;
		}

		// If match found, remove both users from queue and delete their user entries concurrenntly
		await this.client.multi()
			.zRem(queueKey, [requestingUserId, bestCandidate.userId])
			.del([this.buildWaitingUserKey(requestingUserId), this.buildWaitingUserKey(bestCandidate.userId)])
			.exec();
		const remainingQueueSize = await this.client.zCard(queueKey);

		this.logger.info('Users matched and dequeued', {
			requestingUserId,
			matchedUserId: bestCandidate.userId,
			queueKey,
			remainingQueueSize,
			isPerfect:
				requester.criteria.language === bestCandidate.criteria.language &&
				requester.criteria.difficulty === bestCandidate.criteria.difficulty
		});

		return {
			userAId: requester.userId,
			userBId: bestCandidate.userId,
			isPerfect:
				requester.criteria.language === bestCandidate.criteria.language &&
				requester.criteria.difficulty === bestCandidate.criteria.difficulty,
			criteriaA: requester.criteria,
			criteriaB: bestCandidate.criteria,
			queuedAtUserA: requester.queuedAt,
			queuedAtUserB: bestCandidate.queuedAt
		};
	}

	private calculateCompatibilityScore(a: MatchCriteria, b: MatchCriteria): number {
		const languageMatch = a.language === b.language ? 1 : 0;
		const difficultyMatch = this.getDifficultyUtility(a.difficulty, b.difficulty);
		return languageMatch * 5 + difficultyMatch;
	}

	private getDifficultyUtility(a: MatchCriteria['difficulty'], b: MatchCriteria['difficulty']): number {
		const distance = Math.abs(this.difficultyRank[a] - this.difficultyRank[b]);
		if (distance === 0) {
			return 3;
		}
		if (distance === 1) {
			return 2;
		}
		return 1;
	}

	async savePendingConfirmation(match: CandidateMatch): Promise<void> {
		const state: PendingConfirmationState = {
			proposedMatch: match,
			acceptedUserIds: new Set<string>()
		};
		const matchId = this.buildPendingMatchId(match);

		// Save pending confirmation state and index by both user ids concurrently
		await this.client.multi()
			.set(this.buildPendingByUserKey(match.userAId), matchId)
			.set(this.buildPendingByUserKey(match.userBId), matchId)
			.set(this.buildPendingStateKey(matchId), JSON.stringify({
				proposedMatch: state.proposedMatch,
				acceptedUserIds: []
			}))
			.exec();

		this.logger.info('Pending imperfect confirmation saved', {
			userAId: match.userAId,
			userBId: match.userBId,
			matchId,
			resolvedCriteria: match.resolvedCriteria
		});
	}

	async getPendingConfirmationByUser(userId: string): Promise<PendingConfirmationState | null> {
		const matchId = await this.client.get(this.buildPendingByUserKey(userId));
		if (!matchId) {
			return null;
		}

		return this.parsePendingState(await this.client.get(this.buildPendingStateKey(matchId)));
	}

	async setUserConfirmation(userId: string, accepted: boolean): Promise<void> {
		const matchId = await this.client.get(this.buildPendingByUserKey(userId));
		if (!matchId) {
			this.logger.warn('Confirmation received without pending match id', { userId, accepted });
			return;
		}
		
		// Ignore if no pending state found
		const state = this.parsePendingState(await this.client.get(this.buildPendingStateKey(matchId)));
		if (!state) {
			this.logger.warn('Confirmation received without pending state', { userId, accepted });
			return;
		}

		if (!accepted) {
			state.acceptedUserIds.delete(userId);
			await this.savePendingState(matchId, state);
			this.logger.info('User declined imperfect confirmation', {
				userId,
				acceptedUserCount: state.acceptedUserIds.size
			});
			return;
		}

		state.acceptedUserIds.add(userId);
		await this.savePendingState(matchId, state);
		this.logger.info('User accepted imperfect confirmation', {
			userId,
			acceptedUserCount: state.acceptedUserIds.size
		});
	}

	async clearPendingConfirmation(match: CandidateMatch): Promise<void> {
		const matchId = this.buildPendingMatchId(match);
		await this.client.multi()
			.del(this.buildPendingByUserKey(match.userAId))
			.del(this.buildPendingByUserKey(match.userBId))
			.del(this.buildPendingStateKey(matchId))
			.exec();
		this.logger.info('Pending imperfect confirmation cleared', {
			userAId: match.userAId,
			userBId: match.userBId,
			matchId
		});
	}
}
