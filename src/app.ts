import { Server as HttpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types/socket.io';
import getUserIdFromToken from './utils/jwt';
import User from './models/user';
import logger from './logger';
import createPrivateMessageHandler from './handlers/privateMessage';
import createDisappearingImageHandler from './handlers/disapperingImage';
import createDisconnectHandler from './handlers/disconnect';
import createMatchHandler from './handlers/match';
import createReadMessageHandler from './handlers/readMessage';
import createTypeHandler from './handlers/type';

export function createApplication(
  httpServer: HttpServer,
  serverOptions: Partial<ServerOptions> = {},
) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, serverOptions);

  // 身份认证中间件
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const userId = getUserIdFromToken(token);
        if (!userId) {
          return next(new Error('认证失败'));
        }
        const user = await User.findById(userId);
        if (!user) {
          return next(new Error('用户不存在'));
        }
        socket.data.user = user;
        return next();
      }
    } catch (err) {
      logger.error('身份认证失败', err);
    }
    return next(new Error('认证失败'));
  });

  // 收到用户连接
  io.on('connection', async (socket) => {
    try {
      logger.info('用户连接', socket.data.user.username);

      // 更新用户状态为在线
      try {
        await User.findByIdAndUpdate(socket.data.user._id, { online: true });
      } catch (err) {
        logger.error('更新用户状态为在线失败', err);
      }

      // 为用户创建一个room
      socket.join(socket.data.user._id);

      const { privateMessageHandler } = createPrivateMessageHandler(socket);
      const { readMessageHandler } = createReadMessageHandler(socket);

      const { matchRequestHandler, matchCancelHandler, matchLeaveHandler } =
        createMatchHandler(socket, io);

      const { startTypingHandler, stopTypingHandler } =
        createTypeHandler(socket);

      const { disappearingImageHandler } =
        createDisappearingImageHandler(socket);

      const { disconnectHandler } = createDisconnectHandler(socket, io);

      // 用户发送私信
      socket.on('privateMessage', privateMessageHandler);

      // 用户阅读消息
      socket.on('readMessages', readMessageHandler);

      // 用户请求匹配
      socket.on('matchRequest', matchRequestHandler);

      // 用户取消匹配
      socket.on('matchCancel', matchCancelHandler);

      // 用户离开匹配
      socket.on('matchLeave', matchLeaveHandler);

      // 用户开始输入
      socket.on('startTyping', startTypingHandler);

      // 用户停止输入
      socket.on('stopTyping', stopTypingHandler);

      // 用户查看闪图
      socket.on('viewDisappearingImage', disappearingImageHandler);

      // 用户断开连接
      socket.on('disconnect', disconnectHandler);
    } catch (err) {
      logger.error('处理用户连接遇到异常', err);
    }
  });

  return io;
}
