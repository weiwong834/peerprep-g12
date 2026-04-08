import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectRedis } from './config/redis';
import { connectRabbitMQ, EXCHANGE_NAME, SESSION_ENDED_ROUTING_KEY } from './config/rabbitmq';
import { persistChatHistory } from './services/persistService';
import { registerChatHandlers } from './socket/chatSocket';
import chatRoutes from './routes/chatRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service' });
});

// routes
app.use('/chat', chatRoutes);

// socket.io
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  registerChatHandlers(io, socket);
});

async function startRabbitMQConsumer(): Promise<void> {
  const channel = await connectRabbitMQ();

  const { queue } = await channel.assertQueue('chat.session.ended', { durable: true });
  await channel.bindQueue(queue, EXCHANGE_NAME, SESSION_ENDED_ROUTING_KEY);

  console.log('Chat Service: Waiting for session.ended events...');

  channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const { session_id } = JSON.parse(msg.content.toString()) as { session_id: string };
      console.log(`Received session.ended for session ${session_id}`);
      await persistChatHistory(session_id);
      channel.ack(msg);
    } catch (err) {
      console.error('Failed to process session.ended event:', err);
      channel.nack(msg, false, true);
    }
  });
}

const PORT = process.env.PORT || 3004;

const start = async () => {
  try {
    await connectRedis();
    await startRabbitMQConsumer();
    httpServer.listen(PORT, () => {
      console.log(`Chat service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();