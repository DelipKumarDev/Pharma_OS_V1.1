import bcrypt from 'bcrypt';
import { config } from '../config';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}
