const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const storyId = '5c058e29-ef82-4304-af63-b908bfaae2c1'
    console.log(`Querying story ${storyId}...`)
    const story = await prisma.story.findFirst({
      where: { id: storyId },
      include: {
        comments: true
      }
    })
    console.log('Story found:', !!story)
    if (story) {
      console.log('Comments count:', story.comments.length)
      for (const c of story.comments) {
          console.log(`Comment ${c.id} personId: ${c.personId}`)
      }
    }
  } catch (error) {
    console.error('Prisma Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
