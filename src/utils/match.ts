import Session, { ISession } from '../models/session';
import { IUser } from '../models/user';
import logger from '../logger';
import { v4 as uuidv4 } from 'uuid';

const matchingQueue: IUser[] = [];
const matchedPairs = new Map<string, string>();

function isPeer(userId: string, peerId: string) {
  return (
    matchedPairs.get(userId) === peerId && matchedPairs.get(peerId) === userId
  );
}

function tryMatch(diffGender = false) {
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
    matchedPairs.set(user1._id, user2._id);
    matchedPairs.set(user2._id, user1._id);
    return {
      session,
      user1,
      user2,
    };
  } else {
    if (user1) matchingQueue.unshift(user1);
  }
  logger.info(
    '当前匹配队列',
    matchingQueue.map((u) => u.username),
  );
}

function addToQueue(user: IUser) {
  if (matchingQueue.some((u) => u._id === user._id)) {
    logger.error('请求匹配失败', '用户已在匹配队列中');
    throw new Error('用户已在匹配队列中');
  }
  matchingQueue.push(user);
}

function removeFromQueue(user: IUser) {
  const index = matchingQueue.findIndex((u) => u._id === user._id);
  if (index !== -1) {
    matchingQueue.splice(index, 1);
  }
}

function leaveMatch(user: IUser) {
  const targetId = matchedPairs.get(user._id);
  if (targetId) {
    matchedPairs.delete(targetId);
    matchedPairs.delete(user._id);
  }
  return targetId;
}

export { tryMatch, isPeer, addToQueue, removeFromQueue, leaveMatch };
