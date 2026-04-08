import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectRabbitMQ } from './config/rabbitmq';
import { connectRedis } from './config/redis';
import sessionRoutes from './routes/sessionRoutes';
import { initCollabService, startRetryJob } from './services/collabService';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// middleware
app.use(cors());
app.use(express.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'collaboration-service' });
});

// routes
app.use('/sessions', sessionRoutes);

const PORT = process.env.PORT || 3003;

const start = async () => {
  try {
    await connectRedis();
    await connectRabbitMQ();
    initCollabService(httpServer);
    startRetryJob();
    httpServer.listen(PORT, () => {
      console.log(`Collaboration service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();