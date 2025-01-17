// authRoutes.ts
import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { authenticateJWT } from '../Middlewares/authMiddleware';

const authRouter: Router = Router();

authRouter.post('/registro', register);
authRouter.post('/login', login);

export default authRouter;
