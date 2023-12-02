import { IMessage } from '../models/message';

interface IServerToClientMessage {
  sessionId: string;
  message: IMessage;
}

interface ServerToClientEvents {
  privateMessage: (message: IServerToClientMessage) => void;
  startTyping: (sessionId: string) => void;
  stopTyping: (sessionId: string) => void;
  viewImage: (sessionId: string, messageId: string) => void;
}

interface ClientToServerEvents {
  privateMessage: (
    message: IMessage,
    callback: (message: IServerToClientMessage) => void,
  ) => void;
  startTyping: (sessionId: string) => void;
  stopTyping: (sessionId: string) => void;
  readMessages: (sessionId: string) => void;
  viewImage: (sessionId: string, messageId: string) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  userId: string;
  username: string;
}

export {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
};
