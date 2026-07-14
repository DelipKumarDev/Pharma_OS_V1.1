import 'dotenv/config';
import { config } from './config';
import { connectDB, disconnectDB } from './config/database';
import { logger } from './utils/logger';
import { startAlertScheduler } from './jobs/alerts.job';
import app from './app';
import fs from 'fs';
import path from 'path';

// Ensure log and upload dirs exist
[config.LOG_DIR, config.UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function startServer(): Promise<void> {
  try {
    await connectDB();

    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 PharmaOS API running on http://localhost:${config.PORT}`);
      logger.info(`📋 Environment: ${config.NODE_ENV}`);
      logger.info(`🔒 JWT expires: ${config.JWT_EXPIRES_IN}`);
    });

    startAlertScheduler();

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

void startServer();
