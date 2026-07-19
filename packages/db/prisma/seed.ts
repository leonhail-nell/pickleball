import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function hash(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@pickleplay.local' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@pickleplay.local',
      passwordHash: hash('admin123'),
      role: 'ADMIN',
      rating: 4.0,
    },
  });
  for (let n = 1; n <= 4; n++) {
    await prisma.court.upsert({
      where: { number: n },
      update: {},
      create: { number: n, label: n === 1 ? 'Near entrance' : '' },
    });
  }
  // demo players
  for (let i = 1; i <= 12; i++) {
    const email = `player${i}@pickleplay.local`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `Player ${i}`,
        email,
        passwordHash: hash('player123'),
        rating: 3.0 + (i % 5) * 0.25,
      },
    });
  }
  console.log('Seeded: admin@pickleplay.local/admin123, 12 players (player123), 4 courts');
}

main().finally(() => prisma.$disconnect());
