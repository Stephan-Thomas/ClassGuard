import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/classguard',
  jwtSecret: process.env.JWT_SECRET || 'classguard-academic-jwt-secret-2026',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  environment: process.env.NODE_ENV || 'development',
};
