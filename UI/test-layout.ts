import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const families = await prisma.familyUnit.findMany({
    include: {
      parents: { include: { parent: true } },
      children: { include: { child: true } }
    }
  })
  console.log("Families length:", families.length)
}
main().catch(console.error).finally(() => prisma.$disconnect())
