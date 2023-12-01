import { IMessage } from '../models/message';

interface IServerToClientMessage {
  sessionId: string;
  message: IMessage;
}

interface ServerToClientEvents {
  privateMessage: (message: IServerToClientMessage) => void;
}

interface ClientToServerEvents {
  privateMessage: (
    message: IMessage,
    callback: (message: IServerToClientMessage) => void,
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
