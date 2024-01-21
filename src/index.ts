import { createServer } from 'http';
import mongoose from 'mongoose';

import logger from './logger';
import config from './config';
import { createApplication } from './app';

async function startApplication() {
  try {
    await mongoose.connect(config.dbUrl, {
      user: config.dbUser,
      pass: config.dbPass,
      authSource: config.dbAuthSource,
    });
    logger.info('数据库连接成功!');

    const httpServer = createServer();
    createApplication(httpServer, {
      cors: {
        origin: config.origin,
      },
    });
    httpServer.listen(config.port, () => {
      logger.info(`服务器启动成功，端口号：${config.port}`);
    });
  } catch (err) {
    logger.error('服务器启动失败!', err);
    process.exit(1);
  }
}

startApplication();
