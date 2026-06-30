import { Router } from 'express';
import { getHomeContent, getAppSettings } from '../controllers/contentController';

const router = Router();

router.get('/home', getHomeContent);
router.get('/settings', getAppSettings);

export default router;