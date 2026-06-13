import jwt from 'jsonwebtoken';
import { config } from '../config/config';
export const generateToken = (payload) => {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '1d' });
};
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, config.jwtSecret);
    }
    catch (error) {
        return null;
    }
};
