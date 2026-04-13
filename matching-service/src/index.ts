import 'dotenv/config'
import { createServer } from 'http';
import { Server } from 'socket.io';
import express, { type Request, type Response } from 'express';
import { MatchingService } from './services/matchingService.js';
import { RedisService } from './services/redisService.js';
import { QuestionService } from './services/questionService.js';
import { createLogger } from './utils/logger.js';
import { createSocketAuthMiddleware } from './middleware/authMiddleware.js';
import {
  ActionFlowStatus,
  MatchResponseStatus,
  WebSocketEventType,
  type CancelRequestPayload,
  type ConfirmRequestPayload,
  type MatchRequestPayload
} from './types/matchingEvents.js';
import createMatchingRoutes from './routes/matchingRoutes.js';

const app = express();
const logger = createLogger('index');
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', // assuming frontend runs on port 5173
    methods: '*'
  }
});

const redisService = new RedisService();
const userServiceBaseUrl = process.env.USER_SERVICE_URL ?? 'http://localhost:3000';
const questionServiceBaseUrl = process.env.QUESTION_SERVICE_URL ?? 'http://localhost:3001';
const collaborationServiceBaseUrl = process.env.COLLABORATION_SERVICE_URL ?? 'http://localhost:3003';
const questionService = new QuestionService(questionServiceBaseUrl);
const matchingService = new MatchingService(io, redisService, questionService, collaborationServiceBaseUrl);

app.use(express.json());

const PORT = Number(process.env.PORT ?? 3002);

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.send('Matching Service is running');
});

// Routes
app.use('/', createMatchingRoutes(redisService, matchingService));

// One-time JWT auth at handshake
io.use(createSocketAuthMiddleware(userServiceBaseUrl));

// Listens for connection event
// TBD with frontend: Should frontend connect to socket upon entering matching page?
io.on('connection', (socket) => {
  logger.info('Socket connected', { socketId: socket.id });

  // Listens for match request event from frontend: Upon user clicking "Find Match" button
  // which should MatchRequestPayload (defined in matchingEvents.ts)
  socket.on(WebSocketEventType.MATCH_REQUEST, async (payload: MatchRequestPayload) => {
    logger.info('Received MATCH_REQUEST', {
      socketId: socket.id,
      userId: payload.userId,
      criteria: payload.criteria
    });
    try {
      await matchingService.handleMatchRequest(socket, payload);
    } catch (error) {
      logger.error('Failed to process MATCH_REQUEST', {
        socketId: socket.id,
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      socket.emit(WebSocketEventType.MATCH_RESPONSE, {
        status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
        flowStatus: ActionFlowStatus.TERMINATED,
        message: 'Unable to process match request.'
      });
    }
  });

  // Listens for cancel request event from frontend: Upon user clicking "Cancel" button while waiting for match
  socket.on(WebSocketEventType.CANCEL_REQUEST, async (payload: CancelRequestPayload) => {
    logger.info('Received CANCEL_REQUEST', {
      socketId: socket.id,
      userId: payload.userId
    });
    try {
      await matchingService.handleCancelRequest(socket, payload);
    } catch (error) {
      logger.error('Failed to process CANCEL_REQUEST', {
        socketId: socket.id,
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      socket.emit(WebSocketEventType.CANCEL_RESPONSE, {
        status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
        flowStatus: ActionFlowStatus.TERMINATED,
        message: 'Unable to process cancel request.'
      });
    }
  });

  socket.on(WebSocketEventType.CONFIRM_REQUEST, async (payload: ConfirmRequestPayload) => {
    logger.info('Received CONFIRM_REQUEST', {
      socketId: socket.id,
      userId: payload.userId,
      accepted: payload.accepted
    });
    try {
      await matchingService.handleConfirmRequest(socket, payload);
    } catch (error) {
      logger.error('Failed to process CONFIRM_REQUEST', {
        socketId: socket.id,
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      socket.emit(WebSocketEventType.MATCH_RESPONSE, {
        status: MatchResponseStatus.UNSUCCESSFUL_MATCH,
        flowStatus: ActionFlowStatus.TERMINATED,
        message: 'Unable to process confirmation request.'
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id });
    matchingService.handleSocketDisconnect(socket.id);
  });
});

httpServer.listen(PORT, '0.0.0.0', async () => {
  await redisService.connect();
  await questionService.connect();
  logger.info('Matching service listening', {
    port: PORT,
    collaborationServiceBaseUrl,
    questionServiceBaseUrl
  });
});