import { v4 as uuidv4 } from 'uuid';

import { ClientToServerEvents, MySocket } from '../types/socket.io';
import Session, { ISession } from '../models/session';
import { IMessage } from '../models/message';
import logger from '../logger';
import { isPeer } from '../utils/match';

function createPrivateMessageHandler(socket: MySocket) {
  const user = socket.data.user;
  const userId = user._id;

  const privateMessageHandler: ClientToServerEvents['privateMessage'] = async (
    sessionId,
    message,
    callback,
  ) => {
    try {
      const senderId = userId;
      const recipientId = message.recipientId;
      const content = message.content;
      const messageType = message.type;
      const timestamp = new Date(message.timestamp);
      logger.info('发送私信', senderId, recipientId, content, messageType);

      if (content.length > 500) {
        logger.error('发送私信失败', '消息过长');
        callback({ type: 'ERROR', message: '消息过长' });
        return;
      }

      // 创建消息对象
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
          // 如果是匿名session，检查双方是否是正在匹配的用户
          if (!isPeer(senderId, recipientId)) {
            logger.error('发送私信失败', '会话不存在');
            callback({ type: 'ERROR', message: '会话不存在' });
            return;
          }
        }
      } else {
        // 没有指定sessionId，判断是否存在非匿名会话
        session = await Session.findOne({
          anonymous: false,
          $or: [
            { initiatorId: senderId, recipientId: recipientId },
            { initiatorId: recipientId, recipientId: senderId },
          ],
        });
        // 如果存在senderId和recipientId的会话，要求用户指定sessionId
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
  };
  return {
    privateMessageHandler,
  };
}

export default createPrivateMessageHandler;
