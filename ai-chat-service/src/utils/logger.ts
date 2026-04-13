/*
AI Assistance Disclosure:
Tool: ChatGPT (model: GPT-5.3-Codex), date: 2026‐03-26
Scope: Generated logger for matching service backend (reused for ai-chat-service).
Author review: I validated correctness.
*/

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

function serializeMeta(meta?: Record<string, unknown>): string {
	if (!meta) {
		return '';
	}

	try {
		return ` ${JSON.stringify(meta)}`;
	} catch {
		return ' {"meta":"unserializable"}';
	}
}

function writeLog(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
	const timestamp = new Date().toISOString();
	const line = `[${timestamp}] [${level}] [${scope}] ${message}${serializeMeta(meta)}`;

	if (level === 'ERROR') {
		console.error(line);
		return;
	}

	if (level === 'WARN') {
		console.warn(line);
		return;
	}

	console.log(line);
}

export class Logger {
	constructor(private readonly scope: string) {}

	debug(message: string, meta?: Record<string, unknown>): void {
		writeLog('DEBUG', this.scope, message, meta);
	}

	info(message: string, meta?: Record<string, unknown>): void {
		writeLog('INFO', this.scope, message, meta);
	}

	warn(message: string, meta?: Record<string, unknown>): void {
		writeLog('WARN', this.scope, message, meta);
	}

	error(message: string, meta?: Record<string, unknown>): void {
		writeLog('ERROR', this.scope, message, meta);
	}
}

export function createLogger(scope: string): Logger {
	return new Logger(scope);
}
