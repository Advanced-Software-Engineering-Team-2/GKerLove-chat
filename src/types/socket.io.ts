import { IMessage, messageType } from '../models/message';

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
}

interface ServerToClientEvents {
  privateMessage: (message: IServerToClientMessage) => void;
  viewDisappearingImage: (sessionId: string, messageId: string) => void;
  startTyping: (sessionId: string) => void;
  stopTyping: (sessionId: string) => void;
}

interface ClientToServerEvents {
  privateMessage: (
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
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  userId: string;
  username: string;
}

export {
  R,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
};
