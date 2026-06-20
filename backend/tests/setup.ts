import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import * as path from 'path';

process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-key';

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  
  const tableNames = [
    'AuditLog',
    'ReviewCriterionScore',
    'RubricCriterion',
    'Review',
    'Appeal',
    'Submission',
    'Assignment',
    'CourseMember',
    'Course',
    'User',
  ];
  
  for (const tableName of tableNames) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}";`);
    } catch (e) {
    }
  }
  
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
}

beforeAll(async () => {
  try {
    execSync(`npx prisma migrate deploy`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
    });
  } catch (e: any) {
    console.log('Migrate deploy output:', e.stdout?.toString());
    console.log('Migrate deploy error:', e.stderr?.toString());
    throw e;
  }
  await prisma.$connect();
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await prisma.$disconnect();
});

export { prisma, bcrypt };
