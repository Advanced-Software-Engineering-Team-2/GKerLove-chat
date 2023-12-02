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
import Session, { ISession } from './models/session';
import { randomUUID } from 'crypto';

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
        origin: 'http://localhost:5173',
      },
    });

    // 身份认证中间件
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

      // 收到用户发送私信
      socket.on('privateMessage', async (message, callback) => {
        const senderId = userId;
        const recipientId = message.recipientId;
        logger.info(
          '发送私信',
          senderId,
          recipientId,
          message.content,
          message.type,
        );
        const session = await Session.findOne({
          $or: [
            { initiatorId: senderId, recipientId: recipientId },
            { initiatorId: recipientId, recipientId: senderId },
          ],
        });
        if (session) {
          await session.updateOne({
            $push: { messages: message },
          });
          callback({
            sessionId: session._id,
            message,
          });
          socket.to(recipientId).to(socket.data.userId).emit('privateMessage', {
            sessionId: session._id,
            message,
          });
        } else {
          const newSession = new Session<ISession>({
            _id: randomUUID(),
            initiatorId: senderId,
            recipientId: recipientId,
            messages: [message],
          });
          await newSession.save();
          callback({
            sessionId: newSession._id,
            message,
          });
          socket.to(recipientId).to(socket.data.userId).emit('privateMessage', {
            sessionId: newSession._id,
            message,
          });
        }
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

      // 用户开始输入
      socket.on('startTyping', async (sessionId) => {
        const session = await Session.findOne({
          _id: sessionId,
          $or: [{ initiatorId: userId }, { recipientId: userId }],
        });
        if (!session) return;
        const targetId =
          userId === session.initiatorId
            ? session.recipientId
            : session.initiatorId;
        socket.to(targetId).emit('startTyping', sessionId);
      });

      // 用户停止输入
      socket.on('stopTyping', async (sessionId) => {
        const session = await Session.findOne({
          _id: sessionId,
          $or: [{ initiatorId: userId }, { recipientId: userId }],
        });
        if (!session) return;
        const targetId =
          userId === session.initiatorId
            ? session.recipientId
            : session.initiatorId;
        socket.to(targetId).emit('stopTyping', sessionId);
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
            lastOnline: new Date(),
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
