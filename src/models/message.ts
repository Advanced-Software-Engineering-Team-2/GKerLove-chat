import { Schema } from 'mongoose';

export interface IMessage {
  _id: string;
  timestamp: Date;
  type: 'text' | 'image' | 'disappearing';
  senderId: string;
  recipientId: string;
  content: string;
  viewed?: boolean;
}

export const messageSchema = new Schema<IMessage>({
  _id: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: { type: String, required: true },
  senderId: { type: String, required: true },
  recipientId: { type: String, required: true },
  content: { type: String, required: true },
  viewed: { type: Boolean, required: false },
});
