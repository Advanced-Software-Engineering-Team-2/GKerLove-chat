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
import User, { IUser } from './models/user';
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

    const matchingQueue: IUser[] = [];
    const matchedPairs = new Map<string, string>();

    const tryMatch = (diffGender = false) => {
      if (matchingQueue.length < 2) {
        return;
      }
      let user1, user2;
      if (diffGender) {
        for (let i = 0; i < matchingQueue.length; i++) {
          for (let j = i + 1; j < matchingQueue.length; j++) {
            if (matchingQueue[i].gender !== matchingQueue[j].gender) {
              user1 = matchingQueue[i];
              user2 = matchingQueue[j];
              matchingQueue.splice(j, 1);
              matchingQueue.splice(i, 1);
              break;
            }
          }
          if (user1 && user2) {
            break;
          }
        }
      } else {
        user1 = matchingQueue.shift();
        user2 = matchingQueue.shift();
      }
      if (user1 && user2) {
        const session = new Session<ISession>({
          _id: uuidv4(),
          initiatorId: user1._id,
          recipientId: user2._id,
          anonymous: true,
          messages: [],
        });
        try {
          session.save();
        } catch (err) {
          logger.error('创建会话失败', err);
          matchingQueue.unshift(user1);
          matchingQueue.unshift(user2);
          return;
        }
        logger.info('匹配成功', user1.username, user2.username);
        io.to(user1._id).emit('matchSuccess', session._id, user2._id);
        io.to(user2._id).emit('matchSuccess', session._id, user1._id);
        matchedPairs.set(user1._id, user2._id);
        matchedPairs.set(user2._id, user1._id);
      } else {
        if (user1) matchingQueue.unshift(user1);
      }
      logger.info(
        '当前匹配队列',
        matchingQueue.map((u) => u.username),
      );
    };

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
          socket.data.user = user;
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
        const user = socket.data.user;
        const userId = user._id;
        const username = user.username;
        logger.info('用户连接', username);

        // 更新用户状态为在线
        try {
          await User.findByIdAndUpdate(userId, { online: true });
        } catch (err) {
          logger.error('更新用户状态为在线失败', err);
        }

        // 为用户创建一个room
        socket.join(userId);

        // 用户发送发送私信
        socket.on('privateMessage', async (sessionId, message, callback) => {
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
            if (sessionId) {
              // 如果指定了sessionId，检查会话是否存在
              session = await Session.findOne({
                _id: sessionId,
                $or: [
                  { initiatorId: senderId, recipientId: recipientId },
                  { initiatorId: recipientId, recipientId: senderId },
                ],
              });
              if (!session) {
                logger.error('发送私信失败', '会话不存在');
                callback({ type: 'ERROR', message: '会话不存在' });
                return;
              }
              if (session.anonymous) {
                // 判断双方是否是正在匹配的用户
                const index1 = matchingQueue.findIndex(
                  (u) => u._id === senderId,
                );
                const index2 = matchingQueue.findIndex(
                  (u) => u._id === recipientId,
                );
                if (index1 === -1 || index2 === -1) {
                  logger.error('发送私信失败', '会话不存在');
                  callback({ type: 'ERROR', message: '会话不存在' });
                  return;
                }
              }
            } else {
              // 没有指定sessionId，判断是否存在会话
              session = await Session.findOne({
                $or: [
                  { initiatorId: senderId, recipientId: recipientId },
                  { initiatorId: recipientId, recipientId: senderId },
                ],
              });
              if (session) {
                logger.error('发送私信失败', '未指定会话ID');
                callback({ type: 'ERROR', message: '未指定会话ID' });
                return;
              }
            }
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
            socket.to(recipientId).to(userId).emit('privateMessage', {
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

        // 收到用户匹配请求，将用户加入匹配队列
        // 并尝试匹配
        socket.on('matchRequest', (callback) => {
          try {
            logger.info('请求匹配', userId);
            if (matchingQueue.some((u) => u._id === userId)) {
              logger.error('请求匹配失败', '用户已在匹配队列中');
              callback({ type: 'ERROR', message: '用户已在匹配队列中' });
            } else {
              matchingQueue.push(user);
              callback({ type: 'SUCCESS' });
              tryMatch();
            }
          } catch (err) {
            logger.error('请求匹配失败', err);
            callback({ type: 'ERROR', message: '请求匹配失败' });
            return;
          }
        });

        // 用户取消匹配，将用户从匹配队列中移除
        socket.on('matchCancel', (callback) => {
          try {
            logger.info('取消匹配', userId);
            const index = matchingQueue.findIndex((u) => u._id === userId);
            if (index !== -1) {
              matchingQueue.splice(index, 1);
            }
            callback({ type: 'SUCCESS' });
          } catch (err) {
            logger.error('取消匹配失败', err);
            callback({ type: 'ERROR', message: '取消匹配失败' });
            return;
          }
        });

        // 用户离开匹配，通知Peer用户
        socket.on('matchLeave', (callback) => {
          try {
            logger.info('离开匹配', userId);
            const targetId = matchedPairs.get(userId);
            if (targetId) {
              io.to(targetId).emit('matchLeave');
              matchedPairs.delete(targetId);
              matchedPairs.delete(userId);
            }
            callback({ type: 'SUCCESS' });
          } catch (err) {
            logger.error('离开匹配失败', err);
            callback({ type: 'ERROR', message: '离开匹配失败' });
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
            const matchingSockets = await io.in(userId).fetchSockets();
            const isDisconnected = matchingSockets.length === 0;
            if (isDisconnected) {
              logger.info('用户断开连接', username);
              // 更新用户状态为离线
              await User.findByIdAndUpdate(userId, {
                online: false,
                lastOnline: new Date(),
              });
            }
            // 如果用户在匹配队列中，将其移除
            const index = matchingQueue.findIndex((u) => u._id === userId);
            if (index !== -1) {
              matchingQueue.splice(index, 1);
            }
            // 如果用户和某个用户匹配，通知对方用户
            const targetId = matchedPairs.get(userId);
            if (targetId) {
              io.to(targetId).emit('matchLeave');
              matchedPairs.delete(targetId);
              matchedPairs.delete(userId);
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
