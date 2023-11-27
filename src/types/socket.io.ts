import { IMessage } from '../models/message';

interface ServerToClientEvents {
  messages: (messages: IMessage[]) => void;
  privateMessage: (message: IMessage) => void;
}

interface ClientToServerEvents {
  hello: () => void;
  privateMessage: (
    content: string,
    recipientId: string,
    type: 'text' | 'image',
    callback: (message: IMessage) => void,
  ) => void;
  readMessages: (sessionId: string) => void;
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
