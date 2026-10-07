/**
 * Set a shared, known password on the four Divya Care demo accounts so the
 * login page's "Try a demo account" buttons work. Pilot/demo convenience only.
 *
 * Run: npx tsx scripts/set-demo-passwords.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Divya@Care2026';
const EMAILS = [
  'admin@divyacare.test',       // Admin (owner)
  'ananya@divyacare.test',      // Pharmacist
  'suresh@divyacare.test',      // Cashier (Billing Assistant)
  'rahul.admin@divyacare.test', // Manager (Pharma Admin)
];

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const email of EMAILS) {
    const res = await prisma.user.updateMany({
      where: { email },
      data: {
        passwordHash,
        status: 'active',
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`${res.count === 1 ? 'OK  ' : 'MISS'} ${email}`);
  }
  console.log(`\nShared demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
