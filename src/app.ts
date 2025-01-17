import express, { Application, NextFunction, Request, Response } from 'express';
import routes from './routes';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import slowDown from 'express-slow-down';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import client from './db/turso';

// Configuración de variables de entorno
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'default_secret_key';

// Extiende la sesión para incluir la propiedad `token`
declare module 'express-session' {
  interface SessionData {
    token?: string;
  }
}

// Extiende la interfaz Request para incluir la propiedad `user`
declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
  }
}

// Configuración de seguridad con Helmet
app.use(helmet());

// -------------------------------------------------------------------------------------------
// Autorización para ver las API:
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'tu_secreto',
    resave: false,
    saveUninitialized: true,
  })
);
// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const token = req.session.token;

  if (token) {
    jwt.verify(token, SECRET_KEY as string, (err, decoded) => {
      if (err) {
        return res.redirect('/login');
      } else {
        req.user = decoded; // Agrega el usuario decodificado a la request
        next();
      }
    });
  } else {
    res.redirect('/login');
  }
};

// Ruta para mostrar el formulario de inicio de sesión
app.get('/login', (req: Request, res: Response) => {
  res.render('login');
});

// Ruta para manejar la autenticación
app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    // Consulta a la base de datos para obtener el usuario
    const resultados = await client.execute({
      sql: 'SELECT * FROM usuarios WHERE usuario = ?',
      args: [username],
    });

    // Verifica si se encontró el usuario
    if (resultados.rows.length > 0) {
      const user = resultados.rows[0];

      // Verifica la contraseña usando bcrypt
      const isMatch = await bcrypt.compare(password, user.password as string);
      
      if (isMatch) {
        // Verifica el rol del usuario
        if (user.role_id === 1) {
          // Si la contraseña es correcta y el rol es 1, generar un token JWT
          const token = jwt.sign({ username: user.nombre_usuario }, SECRET_KEY, { expiresIn: '1h' });
          
          // Guardar el token en la sesión (o devolverlo en la respuesta)
          req.session.token = token;
          res.redirect('/');
        } else {
          res.status(403).send('Acceso denegado: no tienes los permisos requeridos');
        }
      } else {
        res.status(401).send('Credenciales incorrectas');
      }
    } else {
      res.status(404).send('Usuario no encontrado');
    }
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).send('Error del servidor');
  }
});

// Ruta protegida para la documentación de las APIs
app.get('/', isAuthenticated, (req: Request, res: Response) => {
  res.render('index', { option: req.query.option || '1' });
});

// -----------------------------------------------------------------------------------


// Configuración de limitador de tasa de solicitudes (Rate Limiter)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Configuración de ralentización de tráfico (Slow Down)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
});
app.use(speedLimiter);

// Configuración de CORS
const allowedOrigins = [process.env.URL_FRONTEND, process.env.URL_LOCAL];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Configuración de multer para manejo de archivos
const storage = multer.memoryStorage();
const upload = multer({
    storage,
}).fields([
    { name: 'imagen_principal', maxCount: 1 },
    { name: 'imagenes_adicionales[]', maxCount: 10 },
    { name: 'file', maxCount: 1 },
]);

//direcciones con los respectvios routes
app.use('/api/v1', upload, routes);

// Configuración del motor de plantillas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Inicio del servidor
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
