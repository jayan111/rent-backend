import { Router } from 'express';
import { searchProducts, getSearchSuggestions } from '../controllers/searchController';

const router = Router();

router.get('/', searchProducts);
router.get('/suggestions', getSearchSuggestions);

export default router;