import { ClientToServerEvents, MySocket } from '../types/socket.io';
import logger from '../logger';
import Session from '../models/session';

function createReadMessageHandler(socket: MySocket) {
  const user = socket.data.user;
  const userId = user._id;

  const readMessageHandler: ClientToServerEvents['readMessages'] = async (
    sessionId,
    callback,
  ) => {
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
  };

  return {
    readMessageHandler,
  };
}

export default createReadMessageHandler;
