import { Schema, model } from 'mongoose';

export interface IUser {
  _id: string;
  username: string;
  email: string;
  gender: '男' | '女';
  online: boolean;
  lastOnline?: Date;
}

export const userSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  username: { type: String, required: true, maxlength: 20 },
  email: { type: String, required: true, maxlength: 50 },
  gender: { type: String, required: true, enum: ['男', '女'] },
  online: { type: Boolean, default: false },
  lastOnline: { type: Date },
});

const User = model<IUser>('User', userSchema);

export default User;
