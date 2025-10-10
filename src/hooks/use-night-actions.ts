
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getFirestore } from 'firebase/firestore';
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';


// START: Hardcoded Firebase Initialization for Client
const firebaseConfig = {
  "apiKey": "mock-api-key",
  "authDomain": "pueblo-duerme-98765.firebaseapp.com",
  "projectId": "pueblo-duerme-98765",
  "storageBucket": "pueblo-duerme-98765.appspot.com",
  "messagingSenderId": "123456789012",
  "appId": "1:123456789012:web:abcdef1234567890abcdef"
};

const app = !getApps().length ? initializeApp(firebaseConfig as FirebaseOptions) : getApp();
const db = getFirestore(app);
// END: Hardcoded Firebase Initialization for Client


export function useNightActions(gameId: string, round: number, playerId: string) {
    const [hasSubmitted, setHasSubmitted] = useState(false);

    useEffect(() => {
        if (!gameId || !playerId || round === 0) {
            setHasSubmitted(false);
            return;
        };

        const actionsQuery = query(
            collection(db, 'night_actions'),
            where('gameId', '==', gameId),
            where('round', '==', round),
            where('playerId', '==', playerId)
        );

        const unsubscribe = onSnapshot(actionsQuery, (snapshot) => {
            setHasSubmitted(!snapshot.empty);
        });

        return () => unsubscribe();
    }, [gameId, round, playerId]);

    return { hasSubmitted };
}
