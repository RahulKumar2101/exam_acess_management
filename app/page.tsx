import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();

  // Traffic Control
  if (session?.user) {
    redirect('/admin/dashboard'); // If logged in -> Go to Dashboard
  } else {
    redirect('/login');           // If NOT logged in -> Go to Login
  }
}