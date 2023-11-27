import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

import logger from './logger';
import config from './config';
import getUserIdFromToken from './utils/jwt';

import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types/socket.io';
import User from './models/user';
import Message from './models/message';
import Session from './models/session';

async function startApp() {
  try {
    await mongoose.connect(config.dbUrl, {
      user: config.dbUser,
      pass: config.dbPass,
      authSource: config.dbAuthSource,
    });
    logger.info('数据库连接成功!');

    const httpServer = createServer();

    const io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(httpServer, {
      cors: {
        origin: 'http://localhost:8080',
      },
    });

    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      if (token) {
        const userId = getUserIdFromToken(token);
        if (!userId) {
          return next(new Error('认证失败'));
        }
        const user = await User.findById(userId);
        if (!user) {
          return next(new Error('用户不存在'));
        }
        socket.data.userId = userId;
        socket.data.username = user.username;
        return next();
      }
      return next(new Error('认证失败'));
    });

    // 收到用户连接
    io.on('connection', async (socket) => {
      const userId = socket.data.userId;
      const username = socket.data.username;
      logger.info('用户连接', username);

      // 更新用户状态为在线
      User.findByIdAndUpdate(userId, { online: true }).exec();

      // 为用户创建一个room
      socket.join(socket.data.userId);

      // 发送历史消息给用户
      const sessions = await Session.find({
        $or: [{ initiatorId: userId }, { recipientId: userId }],
      });
      const messages = [...sessions.map((session) => session.messages)].flat();
      socket.emit('messages', messages);

      // 收到用户发送私信
      socket.on('privateMessage', async (content, to, type, callback) => {
        logger.info('发送私信', username, to, content, type);
        const message = new Message({
          timestamp: new Date(),
          type,
          senderId: socket.data.userId,
          recipientId: to,
          content,
        });
        await message.save();
        socket
          .to(to)
          .to(socket.data.userId)
          .emit('privateMessage', message.toObject());
        callback(message.toObject());
      });

      // 用户阅读消息
      socket.on('readMessages', async (sessionId) => {
        logger.info('已读消息', username, sessionId);
        const session = await Session.findById(sessionId);
        if (!session) {
          return;
        }
        await session.updateOne({
          [`${
            userId === session.initiatorId ? 'initiator' : 'recipient'
          }LastRead`]: new Date(),
        });
      });

      // 用户断开连接
      socket.on('disconnect', async () => {
        const matchingSockets = await io.in(socket.data.userId).fetchSockets();
        const isDisconnected = matchingSockets.length === 0;
        if (isDisconnected) {
          logger.info('用户断开连接', socket.data.username);
          // 更新用户状态为离线，同时记录离线时间
          User.findByIdAndUpdate(userId, {
            online: false,
            lastOnine: new Date(),
          }).exec();
        }
      });
    });

    httpServer.listen(3000, () => {
      logger.info('服务器启动成功!');
    });
  } catch (err) {
    logger.error('服务器启动失败!', err);
    process.exit(1);
  }
}

startApp();
