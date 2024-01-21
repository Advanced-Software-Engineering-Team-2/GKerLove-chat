import { MyIO, MySocket } from '../types/socket.io';
import logger from '../logger';
import { leaveMatch, removeFromQueue } from '../utils/match';
import User from '../models/user';

function createDisconnectHandler(socket: MySocket, io: MyIO) {
  const user = socket.data.user;
  const username = user.username;
  const userId = user._id;

  const disconnectHandler = async () => {
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
      removeFromQueue(user);
      // 如果用户和某个用户匹配，通知对方用户
      const targetId = leaveMatch(user);
      if (targetId) {
        socket.to(targetId).emit('matchLeave');
      }
    } catch (err) {
      logger.error('处理用户断开连接遇到异常', err);
    }
  };

  return {
    disconnectHandler,
  };
}

export default createDisconnectHandler;
