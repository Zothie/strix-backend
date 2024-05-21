import { Schema, model } from 'mongoose';
export const User = model('User', {
    username: String,
    email: String,
    password: String,
    role: String,
});