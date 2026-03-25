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

  let workspaceId = session.user.defaultWorkspaceId || null

  if (!workspaceId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
      },
      select: { workspaceId: true },
      orderBy: { joinedAt: 'asc' },
    })
    workspaceId = membership?.workspaceId || null
  }

  if (!workspaceId) {
    return {
      redirect: {
        destination: '/family-tree',
        permanent: false,
      },
    }
  }

  const firstPerson = await prisma.person.findFirst({
    where: { workspaceId },
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
