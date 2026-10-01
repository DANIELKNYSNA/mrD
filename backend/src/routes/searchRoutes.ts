import { Router } from 'express';
import { getCategories, getSearch, getSuggestions } from '../controllers/searchController.js';

export const searchRoutes = Router();

searchRoutes.get('/search', getSearch);
searchRoutes.get('/categories', getCategories);
searchRoutes.get('/suggestions', getSuggestions);
