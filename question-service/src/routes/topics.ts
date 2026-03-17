import { Router } from 'express'; 
import { getAllTopics } from '../controllers/topicController';

const router = Router(); 

router.get('/', getAllTopics); 

export default router; 