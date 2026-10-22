import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { lecturersRouter } from './modules/lecturers/lecturers.routes.js';
import { coursesRouter } from './modules/courses/courses.routes.js';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes.js';
import { sessionsRouter } from './modules/sessions/sessions.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    service: 'ClassGuard Central API',
    database: dbStatus,
    serverTime: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount Modules
app.use('/api/auth', authRouter);
app.use('/api/students', studentsRouter);
app.use('/api/lecturers', lecturersRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export async function startServer() {
  try {
    console.log(`Connecting to MongoDB at ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log('Successfully connected to MongoDB.');
  } catch (err: any) {
    console.warn(`[ClassGuard API Warning] MongoDB connection failed: ${err.message}. Central backend will report disconnected state, but API routes will remain active.`);
  }

  const server = app.listen(config.port, () => {
    console.log(`ClassGuard Central API running on http://localhost:${config.port}`);
  });

  return server;
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
