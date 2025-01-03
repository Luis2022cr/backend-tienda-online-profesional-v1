// authRoutes.ts
import { Router } from 'express';
import { register, login, generarCorreoRecuperacion, cambiarContraseña } from '../controllers/authController';
import { authenticateJWT } from '../Middlewares/authMiddleware';

const authRouter: Router = Router();

authRouter.post('/registro', register);
authRouter.post('/login', login);
authRouter.post('/generar-correo-recuperacion', generarCorreoRecuperacion);
authRouter.post('/cambiar-password', cambiarContraseña);

export default authRouter;
