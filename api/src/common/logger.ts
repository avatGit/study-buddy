import pino from 'pino';
import { pinoHttp } from 'pino-http';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[Redacted]',
  },
});

export const requestLogger = pinoHttp({ logger });
