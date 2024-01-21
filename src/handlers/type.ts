import { ClientToServerEvents, MySocket } from '../types/socket.io';
import logger from '../logger';
import Session from '../models/session';

function createTypeHandler(socket: MySocket) {
  const user = socket.data.user;
  const userId = user._id;

  const startTypingHandler: ClientToServerEvents['startTyping'] = async (
    sessionId,
    callback,
  ) => {
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
  };

  const stopTypingHandler: ClientToServerEvents['stopTyping'] = async (
    sessionId,
    callback,
  ) => {
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
  };

  return {
    startTypingHandler,
    stopTypingHandler,
  };
}

export default createTypeHandler;
