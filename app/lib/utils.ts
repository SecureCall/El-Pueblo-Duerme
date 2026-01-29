

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";
import type { Player, PlayerPublicData, PlayerPrivateData } from "@/types";

export const PHASE_DURATION_SECONDS = 60;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toPlainObject<T>(obj: T): T {
    if (obj === undefined) {
        return null as any;
    }
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Timestamp || obj instanceof Date) {
        // Let Firestore handle Date/Timestamp objects
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => toPlainObject(item)) as any;
    }
    
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = (obj as any)[key];
             if (value !== undefined) {
                newObj[key] = toPlainObject(value);
            }
        }
    }
    return newObj as T;
}

export const getMillis = (timestamp: any): number => {
    if (!timestamp) return 0;

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    if (typeof timestamp === 'object' && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    
    return 0;
};

export const sanitizeHTML = (text: string): string => {
  if (typeof text !== 'string') return '';
  // A simple server-safe sanitizer to prevent basic HTML injection.
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};


export function splitPlayerData(player: Player): { publicData: PlayerPublicData, privateData: PlayerPrivateData } {
  const { 
    userId, gameId, displayName, avatarUrl, isAlive, isAI, 
    princeRevealed, joinedAt, votedFor, lastActiveAt,
    ...privateData
  } = player;

  const publicData: PlayerPublicData = {
    userId, gameId, displayName, avatarUrl, isAlive, isAI,
    princeRevealed: princeRevealed || false,
    joinedAt: joinedAt || new Date(),
    votedFor: votedFor || null,
    lastActiveAt: lastActiveAt || new Date(),
  };
  
  // Ensure all fields of PlayerPrivateData are present, even if null
  const fullPrivateData: PlayerPrivateData = {
      role: null,
      isLover: false,
      isCultMember: false,
      biteCount: 0,
      potions: { poison: null, save: null },
      guardianSelfProtects: 0,
      priestSelfHealUsed: false,
      lastHealedRound: 0,
      usedNightAbility: false,
      shapeshifterTargetId: null,
      virginiaWoolfTargetId: null,
      riverSirenTargetId: null,
      ghostMessageSent: false,
      resurrectorAngelUsed: false,
      bansheeScreams: {},
      bansheePoints: 0,
      lookoutUsed: false,
      executionerTargetId: null,
      secretObjectiveId: null,
      seerChecks: [],
      ...privateData,
  };


  return { publicData, privateData: fullPrivateData };
}

    
