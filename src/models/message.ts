import { Schema } from 'mongoose';

export type messageType = 'text' | 'image' | 'disappearing';

export interface IMessage {
  _id: string;
  timestamp: Date;
  type: messageType;
  senderId: string;
  recipientId: string;
  content: string;
  viewed?: boolean;
}

export const messageSchema = new Schema<IMessage>({
  _id: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: {
    type: String,
    required: true,
    enum: ['text', 'image', 'disappearing'],
  },
  senderId: { type: String, required: true },
  recipientId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 50 },
  viewed: { type: Boolean, required: false },
});
