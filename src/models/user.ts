import { Schema, model } from 'mongoose';

export interface IUser {
  _id: string;
  username: string;
  email: string;
  online: boolean;
  lastOnine?: Date;
}

export const userSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
  online: { type: Boolean, default: false },
  lastOnine: { type: Date },
});

userSchema.pre('save', function (next) {
  next(new Error('不可对用户表进行修改'));
});

const User = model<IUser>('User', userSchema);

export default User;
