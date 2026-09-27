import winston from 'winston';
import path from 'path';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProd = config.NODE_ENV === 'production';

// Human-readable in dev (renders metadata like requestId/route/status), so nothing
// attached to a log call is silently dropped.
const textFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${stack ?? message}${metaStr}`;
});

// Machine-readable JSON in production for log aggregation (timestamp, level,
// message, requestId, route, status, duration, user/tenant, code, stack).
const baseFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  isProd ? json() : textFormat,
);

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: baseFormat,
  transports: [
    new winston.transports.Console({
      format: isProd ? baseFormat : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), textFormat),
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
