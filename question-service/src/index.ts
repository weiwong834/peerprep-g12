import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import topicRoutes from './routes/topics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/topics', topicRoutes); 

//Health check 
app.get('/health', (req, res) => {
    res.status(200).json({status: 'Question Service is running'})
});

app.listen(PORT, () => {
    console.log(`Question Service running on port ${PORT}`);
});

export default app;