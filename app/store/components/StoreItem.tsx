'use client';

import { useState } from 'react';
import { Coins, CheckCircle, Loader2, Lock } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/app/providers/AuthProvider';
import { spendCoins, hasPurchased } from '@/lib/firebase/coins';
import { useToast } from '@/app/hooks/use-toast';

export interface StoreItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  image?: string;
  category: string;
  badge?: string;
}

interface StoreItemProps {
  item: StoreItemData;
  userCoins: number | null;
  onPurchase: () => void;
}

export function StoreItem({ item, userCoins, onPurchase }: StoreItemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [owned, setOwned] = useState(false);

  const canAfford = userCoins !== null && userCoins >= item.price;

  const handleBuy = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Inicia sesión', description: 'Necesitas una cuenta para comprar.' });
      return;
    }
    setLoading(true);
    try {
      const already = await hasPurchased(user.uid, item.id);
      if (already) { setOwned(true); setLoading(false); return; }
      await spendCoins(user.uid, item.price, item.id, item.name);
      setOwned(true);
      onPurchase();
      toast({ title: `¡${item.name} desbloqueado!`, description: 'El artículo se ha añadido a tu perfil.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message ?? 'No se pudo completar la compra.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative flex flex-col bg-white/5 border rounded-xl overflow-hidden transition-all hover:bg-white/10 ${owned ? 'border-green-500/60' : canAfford ? 'border-white/20 hover:border-yellow-500/50' : 'border-white/10 opacity-70'}`}>
      {item.badge && (
        <span className="absolute top-2 right-2 z-10 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}

      {item.image ? (
        <div className="relative w-full aspect-square bg-black/30">
          <Image
            src={item.image}
            alt={item.name}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          {owned && (
            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
          )}
        </div>
      ) : (
        <div className="text-4xl py-5 text-center">{item.icon}</div>
      )}

      <div className="p-3 flex flex-col flex-1">
        <h4 className="font-bold text-white text-xs text-center mb-1 leading-tight">{item.name}</h4>
        {!item.image && (
          <p className="text-white/50 text-xs text-center flex-1 mb-3">{item.description}</p>
        )}

        <div className="mt-auto pt-2">
          {owned ? (
            <div className="flex items-center justify-center gap-1 text-green-400 text-xs font-bold py-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Obtenido
            </div>
          ) : (
            <button
              onClick={handleBuy}
              disabled={loading || !canAfford}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${canAfford ? 'bg-yellow-500 hover:bg-yellow-400 text-black active:scale-95' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  {!canAfford && <Lock className="h-3 w-3" />}
                  <Coins className="h-3 w-3" />
                  {item.price.toLocaleString()}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
