import { Router } from 'express'; 
import  { getAllTopics, createTopic, deleteTopic } from '../controllers/topicController';

const router = Router(); 

router.get('/', getAllTopics); 
router.post('/', createTopic);
router.delete('/:name', deleteTopic);

export default router; 