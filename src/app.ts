import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/config';
import { errorResponse } from './utils/response';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// Middlewares
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5177',
  config.corsOrigin, // Auto-read from .env.production (https://freshnfastkw.com)
  'https://freshnfastkw.com',
  'https://www.freshnfastkw.com',
  'https://api.freshnfastkw.com'
];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Policy violation: CORS origin mismatch. Access denied. 🛡️'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', env: config.env });
});

// Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, 'Route not found', 404);
});

// Global Error Handler
app.use(errorHandler);

export default app;
