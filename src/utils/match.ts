import Session, { ISession } from '../models/session';
import { IUser } from '../models/user';
import logger from '../logger';
import { v4 as uuidv4 } from 'uuid';

export type Condition = {
  diffGender: boolean;
  noPreviousMatch: boolean;
};

type QueueItem = {
  user: IUser;
  condition: Condition;
};

const matchingQueue: QueueItem[] = [];
const matchedPairs = new Map<string, string>();

function isPeer(userId: string, peerId: string) {
  return (
    matchedPairs.get(userId) === peerId && matchedPairs.get(peerId) === userId
  );
}

async function checkMatchCondition(item1: QueueItem, item2: QueueItem) {
  if (item1.user._id === item2.user._id) return false;
  if (item1.condition.diffGender || item2.condition.diffGender) {
    // 要求两人性别不能相同
    if (
      !item1.user.gender ||
      !item2.user.gender ||
      item1.user.gender === item2.user.gender
    ) {
      return false;
    }
  }
  if (item1.condition.noPreviousMatch || item2.condition.noPreviousMatch) {
    // 要求两人之前不能匿名匹配过
    try {
      const session = await Session.findOne({
        $or: [
          { initiatorId: item1.user._id, recipientId: item2.user._id },
          { initiatorId: item2.user._id, recipientId: item1.user._id },
        ],
        anonymous: true,
      });
      if (session) {
        return false;
      }
    } catch (err) {
      logger.error('查询匿名会话失败', err);
      return false;
    }
  }
  return true;
}

async function tryMatch(source: QueueItem) {
  if (matchingQueue.some((item) => item.user._id === source.user._id)) {
    logger.error('请求匹配失败', '用户已在匹配队列中');
    throw new Error('用户已在匹配队列中');
  }
  for (let i = 0; i < matchingQueue.length; i++) {
    const target = matchingQueue[i];
    const result = await checkMatchCondition(source, target);
    if (result) {
      matchingQueue.splice(i, 1);
      const session = new Session<ISession>({
        _id: uuidv4(),
        initiatorId: source.user._id,
        recipientId: target.user._id,
        anonymous: true,
        messages: [],
      });
      try {
        session.save();
      } catch (err) {
        logger.error('创建会话失败', err);
        matchingQueue.unshift(source);
        matchingQueue.unshift(target);
        return;
      }
      logger.info('匹配成功', source.user.username, target.user.username);
      matchedPairs.set(source.user._id, target.user._id);
      matchedPairs.set(target.user._id, source.user._id);
      return {
        session,
        user1: source.user,
        user2: target.user,
      };
    }
  }
  matchingQueue.push(source);
  logger.info(
    '当前匹配队列',
    matchingQueue.map((item) => item.user.username),
  );
}

function removeFromQueue(user: IUser) {
  const index = matchingQueue.findIndex((u) => u.user._id === user._id);
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

export { tryMatch, isPeer, removeFromQueue, leaveMatch };
