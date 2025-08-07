import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    _id: string;        // Lucia expects string ids
    email: string;
    hashed_password: string;
    role: 'admin' | 'doctor' | 'nurse' | 'assistant';
}

const userSchema = new Schema<IUser>({
    _id: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    hashed_password: { type: String, required: true },
    role: { type: String, default: 'assistant' }
});

export const User = model<IUser>('User', userSchema);

export interface ISession extends Document {
    _id: string;
    user_id: string;
    active_expires: number;
    idle_expires: number;
}

const sessionSchema = new Schema<ISession>({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    active_expires: { type: Number, required: true },
    idle_expires: { type: Number, required: true }
});

export const Session = model<ISession>('Session', sessionSchema);