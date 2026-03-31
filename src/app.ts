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
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [config.corsOrigin, 'https://freshnfastkw.com', 'http://freshnfastkw.com'];
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('freshnfastkw.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
