/**
 * Fetches and validates list of valid topics.
 */

import { Topic } from '../types/matchingEvents.js';
import { createLogger } from '../utils/logger.js';

export class QuestionService {
	private readonly logger = createLogger('QuestionService');

	constructor(private readonly questionServiceBaseUrl?: string) {}

	// Check that question service is reachable on startup
	async connect(): Promise<void> {
		if (this.questionServiceBaseUrl) {
			this.logger.info('Using question service', { questionServiceBaseUrl: this.questionServiceBaseUrl });
		} else {
			this.logger.warn('Question service not connected.');
		}
	}

	async getValidTopics(): Promise<string[]> {
		try {
			const response = await fetch(`${this.questionServiceBaseUrl}/topics`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
			throw new Error(`Error fetching topics: ${response.status}`);
			}

			const topics: Array<{ name: string; is_empty: boolean }> = await response.json();
			const validTopics = topics
					.filter(topic => !topic.is_empty)
					.map(topic => topic.name);
			this.logger.info('Valid topics:', { validTopics });
			return validTopics;
			
		} catch (error) {
			this.logger.error('Failed to get topics:', {
				error: error instanceof Error ? error.message : String(error)
			});
			return [];
		}
	}

	async validateTopic(topic: string): Promise<boolean> {
		const validTopics = await this.getValidTopics();
		const isValid = validTopics.includes(topic);
		this.logger.info('Topic validation result', { topic, isValid });
		return isValid;
	}
}
