import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { healthRouter } from './health.routes.js';
import { lineRouter } from './line.routes.js';
import { plcConfigRouter } from './plc-config.routes.js';
import { plcRouter } from './plc.routes.js';
import { processRouter } from './process.routes.js';
import { recipeRouter } from './recipe.routes.js';
import { userRouter } from './user.routes.js';

/**
 * Root API router.
 *
 * Purpose: Aggregate and mount all feature routers under `/api`.
 *   Add new feature routers here (e.g. `apiRouter.use('/users', usersRouter)`).
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/lines', lineRouter);
apiRouter.use('/recipes', recipeRouter);
apiRouter.use('/process', processRouter);
apiRouter.use('/plc', plcRouter);
apiRouter.use('/plc-connections', plcConfigRouter);
