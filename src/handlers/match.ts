import { ClientToServerEvents, MyIO, MySocket } from '../types/socket.io';
import logger from '../logger';
import {
  addToQueue,
  leaveMatch,
  removeFromQueue,
  tryMatch,
} from '../utils/match';
import Session, { ISession } from '../models/session';

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

  const findAnnonyousSession = async (sessionId: string) => {
    const session = await Session.findOne({
      _id: sessionId,
      $or: [{ initiatorId: userId }, { recipientId: userId }],
      anonymous: true,
    });
    return session;
  };

  const getPeerId = (session: ISession) => {
    return session.initiatorId === userId
      ? session.recipientId
      : session.initiatorId;
  };

  const viewProfileRequestHandler: ClientToServerEvents['viewProfileRequest'] =
    async (sessionId, callback) => {
      try {
        logger.info('请求查看用户资料', userId);
        const session = await findAnnonyousSession(sessionId);
        if (!session) {
          throw new Error('会话不存在');
        }
        const peerId = getPeerId(session);
        socket.to(peerId).emit('viewProfileRequest', sessionId);
        callback({ type: 'SUCCESS' });
      } catch (err) {
        logger.error('请求查看用户资料失败', err);
        callback({ type: 'ERROR', message: '查看用户资料失败' });
        return;
      }
    };

  const viewProfileResponseHandler: ClientToServerEvents['viewProfileResponse'] =
    async (sessionId, res, callback) => {
      try {
        logger.info('响应查看用户资料', userId);
        const session = await findAnnonyousSession(sessionId);
        if (!session) {
          throw new Error('会话不存在');
        }
        const peerId = getPeerId(session);
        socket.to(peerId).emit('viewProfileResponse', sessionId, res);
        callback({ type: 'SUCCESS' });
      } catch (err) {
        logger.error('响应查看用户资料失败', err);
        callback({ type: 'ERROR', message: '查看用户资料失败' });
        return;
      }
    };

  return {
    matchRequestHandler,
    matchCancelHandler,
    matchLeaveHandler,
    viewProfileRequestHandler,
    viewProfileResponseHandler,
  };
}

export default createMatchHandler;
