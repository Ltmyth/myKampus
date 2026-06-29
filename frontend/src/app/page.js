'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-brand-dark via-brand-medium to-brand-light text-white p-6">
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
        <h2 className="text-xl font-medium tracking-wide">Connecting to My Kampus...</h2>
        <p className="text-sm text-white/60">Verifying secure session</p>
      </div>
    </div>
  );
}
