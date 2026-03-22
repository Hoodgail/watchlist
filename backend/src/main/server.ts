import type { Server } from 'node:http';
import { createHttpApplication } from './composition/createHttpApplication.js';

async function disconnectPrisma(disconnect: () => Promise<void>): Promise<void> {
  try {
    await disconnect();
  } catch (error) {
    console.error('Failed to disconnect Prisma cleanly:', error);
  }
}

function registerShutdownHandlers(server: Server, disconnect: () => Promise<void>): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectPrisma(disconnect);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

export async function startServer(): Promise<Server> {
  const { app, context } = createHttpApplication();

  try {
    await context.prisma.$connect();
    console.log('Database connected successfully');

    const server = app.listen(context.env.PORT, () => {
      console.log(`Server running on http://localhost:${context.env.PORT}`);
      console.log(`Environment: ${context.env.NODE_ENV}`);
    });

    registerShutdownHandlers(server, () => context.prisma.$disconnect());

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
