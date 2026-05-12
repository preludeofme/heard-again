import { LoginPage } from '@/components/pages/LoginPage'

export default function Login() {
  return <LoginPage />
}


export async function getServerSideProps() { return { props: {} } }
