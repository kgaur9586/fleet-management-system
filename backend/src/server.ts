import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB } from './config/database';
import mongoose from 'mongoose';

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    const server = app.listen(env.PORT, () => {
      logger.info(`Server is running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async () => {
      logger.info('Graceful shutdown initiated...');
      server.close(async () => {
        logger.info('Express server closed.');
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed.');
        process.exit(0);
      });

      // Force close if taking too long
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error: any) {
    logger.error(`Error starting server: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error(`Unhandled Rejection: ${reason.message}`);
  // Give time to log, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  // Give time to log, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

startServer();
