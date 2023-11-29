import { Schema } from 'mongoose';

export interface IMessage {
  timestamp: Date;
  type: 'text' | 'image';
  sender_id: string;
  recipient_id: string;
  content: string;
}

export const messageSchema = new Schema<IMessage>({
  timestamp: { type: Date, required: true },
  type: { type: String, required: true },
  sender_id: { type: String, required: true },
  recipient_id: { type: String, required: true },
  content: { type: String, required: true },
});
