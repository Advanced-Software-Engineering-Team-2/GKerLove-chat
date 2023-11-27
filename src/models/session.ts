import { Schema, model } from 'mongoose';
import { IMessage } from './message';
import { messageSchema } from './message';

export interface ISession {
  _id: string;
  initiatorId: string;
  recipientId: string;
  lastUpdated: Date;
  initiatorLastRead?: Date;
  recipientLastRead?: Date;
  messages: IMessage[];
}

export const sessionSchema = new Schema<ISession>({
  _id: { type: String, required: true },
  initiatorId: { type: String, required: true },
  recipientId: { type: String, required: true },
  lastUpdated: { type: Date, required: true },
  initiatorLastRead: { type: Date },
  recipientLastRead: { type: Date },
  messages: { type: [messageSchema], default: [] },
});

const Session = model<ISession>('Session', sessionSchema);

export default Session;
