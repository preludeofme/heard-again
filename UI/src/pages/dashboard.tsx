import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/memories',
      permanent: false,
    },
  }
}

export default function DashboardPage() {
  return null
}
