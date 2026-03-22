import { PrismaClient, PlanType, WorkspaceRole, StoryType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default plans
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'Free Local' },
      update: {},
      create: {
        name: 'Free Local',
        planType: PlanType.FREE,
        priceMonthlyCents: 0,
        priceYearlyCents: 0,
        tunnelEnabled: false,
        cloudGpuEnabled: false,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 0,
        storageQuotaBytes: BigInt(0),
        memberQuota: 1,
        voiceProfileQuota: 2,
        prioritySupport: false,
        advancedAnalytics: false,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Connected' },
      update: {},
      create: {
        name: 'Connected',
        planType: PlanType.CONNECTED,
        priceMonthlyCents: 100, // $1/month
        priceYearlyCents: 1000, // $10/year
        tunnelEnabled: true,
        cloudGpuEnabled: false,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 0,
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 10,
        prioritySupport: false,
        advancedAnalytics: false,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Hybrid Compute' },
      update: {},
      create: {
        name: 'Hybrid Compute',
        planType: PlanType.HYBRID,
        priceMonthlyCents: 500, // $5/month
        priceYearlyCents: 5000, // $50/year
        tunnelEnabled: true,
        cloudGpuEnabled: true,
        cloudStorageEnabled: false,
        generationMinutesIncluded: 60, // 60 minutes included
        storageQuotaBytes: BigInt(0),
        memberQuota: 10,
        voiceProfileQuota: 20,
        prioritySupport: true,
        advancedAnalytics: false,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Cloud Hosted' },
      update: {},
      create: {
        name: 'Cloud Hosted',
        planType: PlanType.CLOUD,
        priceMonthlyCents: 1000, // $10/month
        priceYearlyCents: 10000, // $100/year
        tunnelEnabled: false,
        cloudGpuEnabled: true,
        cloudStorageEnabled: true,
        generationMinutesIncluded: 120, // 120 minutes included
        storageQuotaBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
        memberQuota: 20,
        voiceProfileQuota: 50,
        prioritySupport: true,
        advancedAnalytics: true,
      },
    }),
  ]);

  console.log(`Created ${plans.length} plans`);

  // Create demo user if in development
  if (process.env.NODE_ENV === 'development') {
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@heardagain.com' },
      update: {},
      create: {
        email: 'demo@heardagain.com',
        password: '$2a$10$K7L.GeqI.JnBz5Ezu8xXu.O0J.Dz5Wj7YjQ0QmJq7y9VwF.DqDqK', // hashed 'demo123'
        displayName: 'Demo User',
      },
    });

    console.log(`Created demo user: ${demoUser.email}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
