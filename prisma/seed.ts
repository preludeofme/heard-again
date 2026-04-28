import { PrismaClient, PlanType, FamilyspaceRole, StoryType, GedcomSex } from '@prisma/client';

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

  // Create demo user with timeline data if in development
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

    // Create demo familyspace with family data
    const familyspace = await prisma.familyspace.upsert({
      where: { slug: 'demo-family' },
      update: {},
      create: {
        name: 'Demo Family',
        slug: 'demo-family',
        ownerId: demoUser.id,
        planType: PlanType.FREE,
      },
    });

    // Create demo family members with birth/death dates
    const grandfather = await prisma.person.upsert({
      where: { 
        id: 'cdbbe9ec-0423-4a34-9983-7c5a6f137d65'
      },
      update: {},
      create: {
        id: 'cdbbe9ec-0423-4a34-9983-7c5a6f137d65',
        familyspaceId: familyspace.id,
        firstName: 'Robert',
        lastName: 'Johnson',
        displayName: 'Grandpa Bob',
        sex: GedcomSex.M,
        birthDate: new Date('1945-03-15'),
        bio: 'Family patriarch, veteran, and master storyteller.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    const grandmother = await prisma.person.upsert({
      where: { 
        id: 'demo-grandmother-001'
      },
      update: {},
      create: {
        id: 'demo-grandmother-001',
        familyspaceId: familyspace.id,
        firstName: 'Margaret',
        lastName: 'Johnson',
        displayName: 'Grandma Maggie',
        sex: GedcomSex.F,
        birthDate: new Date('1948-07-22'),
        bio: 'Beloved grandmother, amazing cook, and family historian.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    const father = await prisma.person.upsert({
      where: { 
        id: 'demo-father-001'
      },
      update: {},
      create: {
        id: 'demo-father-001',
        familyspaceId: familyspace.id,
        firstName: 'Michael',
        lastName: 'Johnson',
        displayName: 'Mike',
        sex: GedcomSex.M,
        birthDate: new Date('1975-11-08'),
        bio: 'Software engineer and amateur photographer.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    const mother = await prisma.person.upsert({
      where: { 
        id: 'demo-mother-001'
      },
      update: {},
      create: {
        id: 'demo-mother-001',
        familyspaceId: familyspace.id,
        firstName: 'Sarah',
        lastName: 'Johnson',
        displayName: 'Sarah',
        sex: GedcomSex.F,
        birthDate: new Date('1978-05-14'),
        bio: 'Teacher and garden enthusiast.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    const child1 = await prisma.person.upsert({
      where: { 
        id: 'demo-child-001'
      },
      update: {},
      create: {
        id: 'demo-child-001',
        familyspaceId: familyspace.id,
        firstName: 'Emily',
        lastName: 'Johnson',
        displayName: 'Emily',
        sex: GedcomSex.F,
        birthDate: new Date('2005-09-20'),
        bio: 'College student studying biology.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    const child2 = await prisma.person.upsert({
      where: { 
        id: 'demo-child-002'
      },
      update: {},
      create: {
        id: 'demo-child-002',
        familyspaceId: familyspace.id,
        firstName: 'James',
        lastName: 'Johnson',
        displayName: 'Jimmy',
        sex: GedcomSex.M,
        birthDate: new Date('2008-02-11'),
        bio: 'High school sophomore, loves basketball.',
        personType: 'FAMILY',
        createdById: demoUser.id,
      },
    });

    // Create family units with marriage dates
    const grandparentsFamily = await prisma.familyUnit.create({
      data: {
        familyspaceId: familyspace.id,
        marriageDate: new Date('1967-06-10'),
        marriagePlace: 'St. Mary\'s Church, Boston',
      },
    });
    
    // Add parents to grandparents family
    await prisma.familyParent.createMany({
      data: [
        { familyId: grandparentsFamily.id, parentId: grandfather.id, relationshipType: 'BIOLOGICAL', sortOrder: 0 },
        { familyId: grandparentsFamily.id, parentId: grandmother.id, relationshipType: 'BIOLOGICAL', sortOrder: 1 },
      ],
    });

    const parentsFamily = await prisma.familyUnit.create({
      data: {
        familyspaceId: familyspace.id,
        marriageDate: new Date('2000-08-12'),
        marriagePlace: 'Lake Tahoe, California',
      },
    });
    
    // Add parents and children to parents family
    await prisma.familyParent.createMany({
      data: [
        { familyId: parentsFamily.id, parentId: father.id, relationshipType: 'BIOLOGICAL', sortOrder: 0 },
        { familyId: parentsFamily.id, parentId: mother.id, relationshipType: 'BIOLOGICAL', sortOrder: 1 },
      ],
    });
    
    await prisma.familyChild.createMany({
      data: [
        { familyId: parentsFamily.id, childId: child1.id, relationshipType: 'BIOLOGICAL', sortOrder: 0 },
        { familyId: parentsFamily.id, childId: child2.id, relationshipType: 'BIOLOGICAL', sortOrder: 1 },
      ],
    });

    // Create stories with dates
    const story1 = await prisma.story.create({
      data: {
        familyspaceId: familyspace.id,
        title: 'The Great Camping Trip of 1985',
        content: 'Robert took the whole family camping in Yellowstone. It was an adventure we\'ll never forget - the bears, the fishing, the campfires...',
        excerpt: 'A memorable family camping adventure in Yellowstone...',
        storyType: StoryType.MEMORY,
        subjectId: grandfather.id,
        speakerId: grandfather.id,
        storyDate: new Date('1985-07-15'),
        storyDatePrecision: 'EXACT',
        status: 'PUBLISHED',
        createdById: demoUser.id,
      },
    });

    const story2 = await prisma.story.create({
      data: {
        familyspaceId: familyspace.id,
        title: 'How We Met at the Dance',
        content: 'It was the summer of 1965. Margaret was wearing a blue dress, and Robert couldn\'t take his eyes off her...',
        excerpt: 'The romantic story of how Robert and Margaret first met...',
        storyType: StoryType.MEMORY,
        subjectId: grandmother.id,
        speakerId: grandmother.id,
        storyDate: new Date('1965-08-20'),
        storyDatePrecision: 'YEAR',
        status: 'PUBLISHED',
        createdById: demoUser.id,
      },
    });

    const story3 = await prisma.story.create({
      data: {
        familyspaceId: familyspace.id,
        title: 'Emily\'s First Steps',
        content: 'She was only 11 months old when she took her first wobbly steps across the living room floor...',
        excerpt: 'Watching Emily take her first steps was magical...',
        storyType: StoryType.MEMORY,
        subjectId: child1.id,
        speakerId: mother.id,
        storyDate: new Date('2006-08-15'),
        storyDatePrecision: 'APPROXIMATE',
        status: 'PUBLISHED',
        createdById: demoUser.id,
      },
    });

    // Create custom timeline events (PersonEvent)
    await prisma.personEvent.createMany({
      data: [
        {
          personId: grandfather.id,
          eventType: 'EDUCATION',
          eventDate: new Date('1967-05-15'),
          description: 'Graduated from Boston University with a degree in Engineering',
        },
        {
          personId: grandmother.id,
          eventType: 'OCCUPATION',
          eventDate: new Date('1975-03-01'),
          description: 'Opened Maggie\'s Sweet Treats on Main Street',
        },
        {
          personId: father.id,
          eventType: 'OCCUPATION',
          eventDate: new Date('1998-06-01'),
          description: 'Started at TechCorp as junior developer',
        },
        {
          personId: mother.id,
          eventType: 'CUSTOM',
          eventDate: new Date('2015-05-20'),
          description: 'Awarded Teacher of the Year at Lincoln Elementary',
        },
      ],
    });

    console.log('Created demo family with timeline events:');
    console.log(`  - 5 family members with birth dates`);
    console.log(`  - 2 marriages with dates and places`);
    console.log(`  - 3 stories with event dates`);
    console.log(`  - 4 custom timeline events`);
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
