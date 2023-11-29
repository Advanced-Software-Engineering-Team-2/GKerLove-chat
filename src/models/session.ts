import { Schema, model } from 'mongoose';
import { IMessage } from './message';
import { messageSchema } from './message';

export interface ISession {
  _id: string;
  initiator_id: string;
  recipient_id: string;
  last_updated: Date;
  initiator_last_read?: Date;
  recipient_last_read?: Date;
  messages: IMessage[];
}

export const sessionSchema = new Schema<ISession>({
  _id: { type: String, required: true },
  initiator_id: { type: String, required: true },
  recipient_id: { type: String, required: true },
  last_updated: { type: Date, required: true },
  initiator_last_read: { type: Date },
  recipient_last_read: { type: Date },
  messages: { type: [messageSchema], default: [] },
});

const Session = model<ISession>('Session', sessionSchema);

export default Session;
