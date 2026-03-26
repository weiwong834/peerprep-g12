/**
 * Fetches and validates list of valid topics.
 */

import { Topic } from '../types/matchingEvents.js';
import { createLogger } from '../utils/logger.js';

export class QuestionService {
	private readonly logger = createLogger('QuestionService');

	constructor(private readonly questionServiceBaseUrl?: string) {}

	async connect(): Promise<void> {
		// Placeholder: Verify connection to Question Service on startup.
		// Fetch valid topics from REST API.
		if (this.questionServiceBaseUrl) {
			this.logger.info('Using question service', { questionServiceBaseUrl: this.questionServiceBaseUrl });
		} else {
			this.logger.warn('Question service not connected, using enum topics fallback');
		}
	}

	async getValidTopics(): Promise<string[]> {
		// Placeholder: GET /topics from question-service
		// For now, return enum values
		return Object.values(Topic);
	}

	async validateTopic(topic: string): Promise<boolean> {
		// Placeholder: Check if topic exists in Question Service
		const validTopics = await this.getValidTopics();
		const isValid = validTopics.includes(topic);
		this.logger.info('Topic validation result', { topic, isValid });
		return isValid;
	}
}
