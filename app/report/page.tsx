'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ReportForm from '@/components/ReportForm';

export default function ReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace('/login');
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    check();
  }, [router]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">
        Submit Lost or Found Report
      </h1>
      {/* ✅ no props needed now — ReportForm handles its own auth */}
      <ReportForm />
    </div>
  );
}
