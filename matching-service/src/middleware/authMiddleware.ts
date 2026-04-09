import type { Socket } from 'socket.io';
import { createLogger } from '../utils/logger.js';

interface AuthenticatedUser {
	id: string;
	username: string;
	email: string;
	isAdmin: boolean;
}

export interface AuthenticatedSocketData {
	authToken: string;
	authenticatedUser: AuthenticatedUser;
}

const logger = createLogger('MatchingController');

export const createSocketAuthMiddleware = (userServiceBaseUrl: string) => {
	return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
		const auth = socket.handshake.auth as { token?: string } | undefined;
		const token = auth?.token;

		if (!token) {
			next(new Error('Missing authentication token.'));
			return;
		}

		try {
			const response = await fetch(`${userServiceBaseUrl}/user/getUserInfo`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) {
                logger.error(`Authentication failed with status ${response.status}: ${response.statusText}`);
				next(new Error('Invalid or expired authentication token.'));
				return;
			}

			const user = (await response.json()) as AuthenticatedUser;
			socket.data.authToken = token;
			socket.data.authenticatedUser = user;
            logger.info(`User ${user.id} authenticated successfully via socket middleware.`);
			next();
		} catch {
            logger.error('Error occurred while authenticating user with User Service');
			next(new Error('Authentication service unavailable. Please try again.'));
		}
	};
};
