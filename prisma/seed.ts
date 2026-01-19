import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if SUPER_ADMIN already exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.SUPER_ADMIN,
    },
  });

  if (existingSuperAdmin) {
    console.log('✅ SUPER_ADMIN already exists. Skipping creation.');
    console.log(`   Email: ${existingSuperAdmin.email}`);
    return;
  }

  // Generate a temporary password
  const tempPassword = `superadmin_${Date.now()}`;
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // Create SUPER_ADMIN user
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Administrator',
      email: 'superadmin@example.com', // Placeholder - should be changed on first login
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log('✅ SUPER_ADMIN created successfully!');
  console.log('');
  console.log('⚠️  IMPORTANT: Please change the password on first login!');
  console.log('');
  console.log('Super Admin Credentials:');
  console.log(`   Email: ${superAdmin.email}`);
  console.log(`   Temporary Password: ${tempPassword}`);
  console.log('');
  console.log('🔒 Security Note: This is a temporary password. Change it immediately after first login.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
