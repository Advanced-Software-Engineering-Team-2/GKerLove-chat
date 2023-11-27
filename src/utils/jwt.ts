import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../logger';

const getUserIdFromToken = (token: string) => {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload !== 'string') {
      return payload.id;
    } else {
      return undefined;
    }
  } catch (error) {
    logger.error('JWT校验失败', token);
    return undefined;
  }
};

export default getUserIdFromToken;
