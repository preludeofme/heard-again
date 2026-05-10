import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/legacy',
      permanent: false,
    },
  }
}

export default function DashboardPage() {
  return null
}
