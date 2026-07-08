import { http, HttpResponse, delay } from 'msw';
import type { AuthSession } from '@pharmaos/types';

const MOCK_USER: AuthSession = {
  user: {
    id: 'usr_001',
    email: 'admin@divyapharmacy.com',
    name: 'Rahul Sharma',
    phone: '9876543210',
    tenantId: 'tnt_001',
    tenantName: 'Divya Pharmacy',
    tenantSlug: 'divya-pharmacy',
    roles: ['pharma_admin'],
    permissions: [
      'medicine:view', 'medicine:create', 'medicine:edit', 'medicine:delete',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'billing:view', 'billing:create', 'billing:edit',
      'reports:view', 'reports:export',
      'users:view', 'users:create', 'users:edit',
      'settings:view', 'settings:edit',
    ],
    mfaEnabled: false,
    lastLoginAt: new Date().toISOString(),
  },
  tokens: {
    accessToken: 'mock_access_token_pharmaos',
    refreshToken: 'mock_refresh_token_pharmaos',
    expiresIn: 3600,
  },
};

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(800);
    const body = await request.json() as { email: string; password: string };

    const DEMO_EMAILS = [
      'admin@divyapharmacy.com',
      'pharmacist@divyapharmacy.com',
      'cashier@divyapharmacy.com',
      'manager@divyapharmacy.com',
    ];
    if (DEMO_EMAILS.includes(body.email) && body.password === 'Admin@123') {
      return HttpResponse.json({ success: true, data: MOCK_USER });
    }
    return HttpResponse.json(
      { success: false, message: 'Invalid credentials. Please check your email and password.', code: 'AUTH_INVALID_CREDENTIALS' },
      { status: 401 }
    );
  }),

  http.post('/api/auth/logout', async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: null });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(200);
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json({ success: true, data: MOCK_USER.user });
  }),

  http.post('/api/auth/token/refresh', async () => {
    await delay(200);
    return HttpResponse.json({
      success: true,
      data: { accessToken: 'mock_new_access_token', expiresIn: 3600 },
    });
  }),

  http.post('/api/auth/password/forgot', async ({ request }) => {
    await delay(600);
    const body = await request.json() as { email: string };
    return HttpResponse.json({
      success: true,
      data: { message: `Reset link sent to ${body.email}` },
    });
  }),

  http.post('/api/auth/otp/send', async ({ request }) => {
    await delay(700);
    const body = await request.json() as { identifier: string };
    return HttpResponse.json({
      success: true,
      data: { message: `OTP sent to ${body.identifier}`, expiresIn: 300 },
    });
  }),

  http.post('/api/auth/otp/verify', async ({ request }) => {
    await delay(600);
    const body = await request.json() as { identifier: string; otp: string };
    if (body.otp === '123456') {
      return HttpResponse.json({
        success: true,
        data: { resetToken: 'mock_reset_token_xyz', message: 'OTP verified' },
      });
    }
    return HttpResponse.json(
      { success: false, message: 'Invalid OTP. Use 123456 for demo.' },
      { status: 400 }
    );
  }),

  http.post('/api/auth/password/reset', async ({ request }) => {
    await delay(600);
    const body = await request.json() as { resetToken: string; password: string };
    if (body.resetToken === 'mock_reset_token_xyz') {
      return HttpResponse.json({ success: true, data: { message: 'Password reset successfully' } });
    }
    return HttpResponse.json(
      { success: false, message: 'Invalid or expired reset token' },
      { status: 400 }
    );
  }),
];
