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
import { v4 as uuidv4 } from 'uuid';
import { IMessage } from './models/message';

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
        origin: config.origin,
      },
    });

    // 身份认证中间件
    io.use(async (socket, next) => {
      try {
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
      } catch (err) {
        logger.error('身份认证失败', err);
      }
      return next(new Error('认证失败'));
    });

    // 收到用户连接
    io.on('connection', async (socket) => {
      try {
        const userId = socket.data.userId;
        const username = socket.data.username;
        logger.info('用户连接', username);

        // 更新用户状态为在线
        try {
          await User.findByIdAndUpdate(userId, { online: true });
        } catch (err) {
          logger.error('更新用户状态为在线失败', err);
        }

        // 为用户创建一个room
        socket.join(socket.data.userId);

        // 用户发送发送私信
        socket.on('privateMessage', async (message, callback) => {
          try {
            const senderId = userId;
            const recipientId = message.recipientId;
            const content = message.content;
            const messageType = message.type;
            const timestamp = new Date(message.timestamp);
            logger.info(
              '发送私信',
              senderId,
              recipientId,
              content,
              messageType,
            );
            if (content.length > 500) {
              logger.error('发送私信失败', '消息过长');
              callback({ type: 'ERROR', message: '消息过长' });
              return;
            }
            const newMessage: IMessage = {
              _id: uuidv4(),
              timestamp,
              type: messageType,
              senderId,
              recipientId,
              content,
            };
            let session;
            session = await Session.findOne({
              $or: [
                { initiatorId: senderId, recipientId: recipientId },
                { initiatorId: recipientId, recipientId: senderId },
              ],
            });
            if (session) {
              await session.updateOne({
                $push: { messages: newMessage },
              });
            } else {
              session = new Session<ISession>({
                _id: uuidv4(),
                initiatorId: senderId,
                recipientId: recipientId,
                messages: [newMessage],
              });
              await session.save();
            }
            callback({
              type: 'SUCCESS',
              data: {
                sessionId: session._id,
                message: newMessage,
              },
            });
            socket
              .to(recipientId)
              .to(socket.data.userId)
              .emit('privateMessage', {
                sessionId: session._id,
                message: newMessage,
              });
          } catch (err) {
            logger.error('发送私信失败', err);
            callback({ type: 'ERROR', message: '发送私信失败' });
            return;
          }
        });

        // 用户阅读消息
        socket.on('readMessages', async (sessionId, callback) => {
          try {
            logger.info('已读消息', userId, sessionId);
            const session = await Session.findOne({
              _id: sessionId,
              $or: [{ initiatorId: userId }, { recipientId: userId }],
            });
            if (!session) {
              logger.error('已读消息失败', '会话不存在');
              callback({ type: 'ERROR', message: '会话不存在' });
              return;
            }
            await session.updateOne({
              [`${
                userId === session.initiatorId ? 'initiator' : 'recipient'
              }LastRead`]: new Date(),
            });
            callback({ type: 'SUCCESS' });
          } catch (err) {
            logger.error('已读消息失败', err);
            callback({ type: 'ERROR', message: '已读消息失败' });
            return;
          }
        });

        // 用户开始输入
        socket.on('startTyping', async (sessionId, callback) => {
          try {
            logger.info('开始输入', userId, sessionId);
            const session = await Session.findOne({
              _id: sessionId,
              $or: [{ initiatorId: userId }, { recipientId: userId }],
            });
            if (!session) {
              logger.error('开始输入失败', '会话不存在');
              callback({ type: 'ERROR', message: '会话不存在' });
              return;
            }
            const targetId =
              userId === session.initiatorId
                ? session.recipientId
                : session.initiatorId;
            socket.to(targetId).emit('startTyping', sessionId);
            callback({ type: 'SUCCESS' });
          } catch (err) {
            logger.error('开始输入失败', err);
            callback({ type: 'ERROR', message: '开始输入失败' });
            return;
          }
        });

        // 用户停止输入
        socket.on('stopTyping', async (sessionId, callback) => {
          try {
            logger.info('停止输入', userId, sessionId);
            const session = await Session.findOne({
              _id: sessionId,
              $or: [{ initiatorId: userId }, { recipientId: userId }],
            });
            if (!session) {
              logger.error('停止输入失败', '会话不存在');
              callback({ type: 'ERROR', message: '会话不存在' });
              return;
            }
            const targetId =
              userId === session.initiatorId
                ? session.recipientId
                : session.initiatorId;
            socket.to(targetId).emit('stopTyping', sessionId);
            callback({ type: 'SUCCESS' });
          } catch (err) {
            logger.error('停止输入失败', err);
            callback({ type: 'ERROR', message: '停止输入失败' });
            return;
          }
        });

        // 用户查看闪图
        socket.on(
          'viewDisappearingImage',
          async (sessionId, messageId, callback) => {
            try {
              logger.info('查看闪图', userId, sessionId, messageId);
              const session = await Session.findOne({
                _id: sessionId,
                $or: [{ initiatorId: userId }, { recipientId: userId }],
              });
              if (!session) {
                logger.error('查看闪图失败', '会话不存在');
                callback({ type: 'ERROR', message: '会话不存在' });
                return;
              }
              await Session.updateOne(
                { _id: sessionId, 'messages._id': messageId },
                { $set: { 'messages.$.viewed': true } },
              );
              callback({ type: 'SUCCESS' });
              const targetId =
                userId === session.initiatorId
                  ? session.recipientId
                  : session.initiatorId;
              socket
                .to(targetId)
                .emit('viewDisappearingImage', sessionId, messageId);
            } catch (err) {
              logger.error('查看闪图失败', err);
              callback({ type: 'ERROR', message: '查看闪图失败' });
              return;
            }
          },
        );

        // 用户断开连接
        socket.on('disconnect', async () => {
          try {
            const matchingSockets = await io
              .in(socket.data.userId)
              .fetchSockets();
            const isDisconnected = matchingSockets.length === 0;
            if (isDisconnected) {
              logger.info('用户断开连接', socket.data.username);
              try {
                await User.findByIdAndUpdate(userId, {
                  online: false,
                  lastOnline: new Date(),
                });
              } catch (err) {
                logger.error('更新用户状态为离线失败', err);
              }
            }
          } catch (err) {
            logger.error('处理用户断开连接遇到异常', err);
          }
        });
      } catch (err) {
        logger.error('处理用户连接遇到异常', err);
      }
    });

    httpServer.listen(config.port, () => {
      logger.info('服务器启动成功!');
    });
  } catch (err) {
    logger.error('服务器启动失败!', err);
    process.exit(1);
  }
}

startApp();
