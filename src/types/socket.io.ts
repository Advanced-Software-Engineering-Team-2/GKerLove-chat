import { Condition } from '../utils/match';
import { IMessage, messageType } from '../models/message';
import { IUser } from '../models/user';
import { Server, Socket } from 'socket.io';

interface R<T = void> {
  type: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: T;
}

interface IServerToClientMessage {
  sessionId: string;
  message: IMessage;
}

interface IClientToServerMessage {
  type: messageType;
  recipientId: string;
  content: string;
  timestamp: string;
}

interface ServerToClientEvents {
  privateMessage: (message: IServerToClientMessage) => void;
  viewDisappearingImage: (sessionId: string, messageId: string) => void;
  startTyping: (sessionId: string) => void;
  stopTyping: (sessionId: string) => void;
  matchSuccess: (sessionId: string, peerId: string) => void;
  matchLeave: () => void;
  viewProfileRequest: (sessionId: string) => void;
  viewProfileResponse: (sessionId: string, res: boolean) => void;
}

interface ClientToServerEvents {
  privateMessage: (
    sessionId: string,
    message: IClientToServerMessage,
    callback: (res: R<IServerToClientMessage>) => void,
  ) => void;
  viewDisappearingImage: (
    sessionId: string,
    messageId: string,
    callback: (res: R) => void,
  ) => void;
  startTyping: (sessionId: string, callback: (res: R) => void) => void;
  stopTyping: (sessionId: string, callback: (res: R) => void) => void;
  readMessages: (sessionId: string, callback: (res: R) => void) => void;
  matchRequest: (condition: Condition, callback: (res: R) => void) => void;
  matchCancel: (callback: (res: R) => void) => void;
  matchLeave: (callback: (res: R) => void) => void;
  viewProfileRequest: (sessionId: string, callback: (res: R) => void) => void;
  viewProfileResponse: (
    sessionId: string,
    res: boolean,
    callback: (res: R) => void,
  ) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  user: IUser;
}

type MySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type MyIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export {
  MyIO,
  MySocket,
  R,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
};
