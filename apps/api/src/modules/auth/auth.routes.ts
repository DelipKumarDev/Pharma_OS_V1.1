import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimiter';
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/token/refresh', validate(refreshSchema), authController.refreshToken);
router.post('/password/forgot', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/otp/send', validate(sendOtpSchema), authController.sendOtp);
router.post('/otp/verify', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/password/reset', validate(resetPasswordSchema), authController.resetPassword);
router.post('/password/change', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
