import { Schema, model } from 'mongoose';

export interface IMessage {
  timestamp: Date;
  type: 'text' | 'image';
  senderId: string;
  recipientId: string;
  content: string;
}

export const messageSchema = new Schema<IMessage>({
  timestamp: { type: Date, required: true },
  type: { type: String, required: true },
  senderId: { type: String, required: true },
  recipientId: { type: String, required: true },
  content: { type: String, required: true },
});

const Message = model<IMessage>('Message', messageSchema);

export default Message;
