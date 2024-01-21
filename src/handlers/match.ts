import { ClientToServerEvents, MyIO, MySocket } from '../types/socket.io';
import logger from '../logger';
import {
  addToQueue,
  leaveMatch,
  removeFromQueue,
  tryMatch,
} from '../utils/match';

function createMatchHandler(socket: MySocket, io: MyIO) {
  const user = socket.data.user;
  const userId = user._id;

  const matchRequestHandler: ClientToServerEvents['matchRequest'] = (
    callback,
  ) => {
    try {
      logger.info('请求匹配', userId);
      addToQueue(user);
      callback({ type: 'SUCCESS' });
      const res = tryMatch(); // 有一个新用户加入到队列，尝试匹配
      if (res) {
        const { session, user1, user2 } = res;
        io.to(user1._id).emit('matchSuccess', session.id, user2._id);
        io.to(user2._id).emit('matchSuccess', session.id, user1._id);
      }
    } catch (err) {
      logger.error('请求匹配失败', err);
      callback({ type: 'ERROR', message: '请求匹配失败' });
      return;
    }
  };

  const matchCancelHandler: ClientToServerEvents['matchCancel'] = (
    callback,
  ) => {
    try {
      logger.info('取消匹配', userId);
      removeFromQueue(user);
      callback({ type: 'SUCCESS' });
    } catch (err) {
      logger.error('取消匹配失败', err);
      callback({ type: 'ERROR', message: '取消匹配失败' });
      return;
    }
  };

  const matchLeaveHandler: ClientToServerEvents['matchLeave'] = (callback) => {
    try {
      logger.info('离开匹配', userId);
      const targetId = leaveMatch(user);
      if (targetId) {
        socket.to(targetId).emit('matchLeave');
      }
      callback({ type: 'SUCCESS' });
    } catch (err) {
      logger.error('离开匹配失败', err);
      callback({ type: 'ERROR', message: '离开匹配失败' });
      return;
    }
  };

  return {
    matchRequestHandler,
    matchCancelHandler,
    matchLeaveHandler,
  };
}

export default createMatchHandler;
