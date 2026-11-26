import { createApp } from './app.js';
import { logger } from './common/logger.js';
import { connectDatabase } from './config/database.js';
import { loadEnvironment } from './config/env.js';
import { createServer, type Server } from 'node:http';
import mongoose from 'mongoose';

async function startServer(): Promise<void> {
  try {
    const config = loadEnvironment();
    await connectDatabase(config.MONGODB_URI);

    const server = await listen(createApp(config), config.PORT);
    logger.info({ port: config.PORT }, 'StudyBuddy API is listening');

    const shutdown = (signal: NodeJS.Signals): void => {
      logger.info({ signal }, 'Shutting down StudyBuddy API');
      server.close((error) => {
        if (error) {
          logger.error({ err: error }, 'Failed to close the HTTP server cleanly');
          process.exitCode = 1;
        }

        void mongoose
          .disconnect()
          .then(() => logger.info('MongoDB connection closed'))
          .catch((disconnectError: unknown) => {
            logger.error({ err: disconnectError }, 'Failed to close the MongoDB connection');
            process.exitCode = 1;
          });
      });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.fatal({ err: error }, 'StudyBuddy API startup failed');
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        logger.error({ err: disconnectError }, 'Failed to close MongoDB after startup failure');
      }
    }
    process.exitCode = 1;
  }
}

function listen(app: ReturnType<typeof createApp>, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.once('error', reject);
    server.listen(port, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

void startServer();
