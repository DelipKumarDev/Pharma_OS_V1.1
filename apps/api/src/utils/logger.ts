import winston from 'winston';
import path from 'path';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack ?? message}`;
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: path.join(config.LOG_DIR, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(config.LOG_DIR, 'combined.log'),
    }),
  ],
});
