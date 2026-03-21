'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { getUserCoins } from '@/lib/firebase/coins';

export function useCoins() {
  const { user } = useAuth();
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setCoins(null); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await getUserCoins(user.uid);
      setCoins(c);
    } catch {
      setCoins(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { coins, loading, refresh };
}
