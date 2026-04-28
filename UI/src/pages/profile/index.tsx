import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/profile',
        permanent: false,
      },
    }
  }

  let familyspaceId = session.user.defaultFamilyspaceId || null

  if (!familyspaceId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
      },
      select: { familyspaceId: true },
      orderBy: { joinedAt: 'asc' },
    })
    familyspaceId = membership?.familyspaceId || null
  }

  if (!familyspaceId) {
    return {
      redirect: {
        destination: '/family-tree',
        permanent: false,
      },
    }
  }

  const firstPerson = await prisma.person.findFirst({
    where: { familyspaceId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!firstPerson) {
    return {
      redirect: {
        destination: '/family-tree',
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: `/profile/${firstPerson.id}`,
      permanent: false,
    },
  }
}

export default function ProfileIndexRedirect() {
  return null
}
