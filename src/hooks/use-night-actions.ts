
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase';


export function useNightActions(gameId: string, round: number, playerId: string) {
    const { firestore } = useFirebase();
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        if (!gameId || !playerId || round === 0 || !firestore) {
            setHasSubmitted(false);
            return;
        };

        const actionsQuery = query(
            collection(firestore, 'night_actions'),
            where('gameId', '==', gameId),
            where('round', '==', round),
            where('playerId', '==', playerId)
        );

        const unsubscribe = onSnapshot(actionsQuery, (snapshot) => {
            setHasSubmitted(!snapshot.empty);
        });

        return () => unsubscribe();
    }, [gameId, round, playerId, firestore]);

    return { hasSubmitted };
}
