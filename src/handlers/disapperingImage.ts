import { ClientToServerEvents, MySocket } from '../types/socket.io';
import logger from '../logger';
import Session from '../models/session';

function createDisappearingImageHandler(socket: MySocket) {
  const user = socket.data.user;
  const userId = user._id;

  const disappearingImageHandler: ClientToServerEvents['viewDisappearingImage'] =
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
        socket.to(targetId).emit('viewDisappearingImage', sessionId, messageId);
      } catch (err) {
        logger.error('查看闪图失败', err);
        callback({ type: 'ERROR', message: '查看闪图失败' });
        return;
      }
    };

  return {
    disappearingImageHandler,
  };
}

export default createDisappearingImageHandler;
