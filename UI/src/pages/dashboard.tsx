import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/archive',
      permanent: false,
    },
  }
}

export default function DashboardPage() {
  return null
}
