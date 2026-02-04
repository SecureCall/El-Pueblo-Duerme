
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
  // Public Data is everything in the PlayerPublicDataSchema
  const publicData: PlayerPublicData = {
    userId: player.userId,
    gameId: player.gameId,
    displayName: player.displayName,
    avatarUrl: player.avatarUrl,
    isAlive: player.isAlive,
    isAI: player.isAI,
    princeRevealed: player.princeRevealed || false,
    joinedAt: player.joinedAt || new Date(),
    votedFor: player.votedFor || null,
    lastActiveAt: player.lastActiveAt || new Date(),
  };

  // Private Data is everything else, ensuring we don't miss anything.
  const privateData: PlayerPrivateData = {
    role: player.role || null,
    isLover: player.isLover || false,
    isCultMember: player.isCultMember || false,
    biteCount: player.biteCount || 0,
    potions: player.potions || { poison: null, save: null },
    guardianSelfProtects: player.guardianSelfProtects || 0,
    priestSelfHealUsed: player.priestSelfHealUsed || false,
    lastHealedRound: player.lastHealedRound || 0,
    usedNightAbility: player.usedNightAbility || false,
    shapeshifterTargetId: player.shapeshifterTargetId || null,
    virginiaWoolfTargetId: player.virginiaWoolfTargetId || null,
    riverSirenTargetId: player.riverSirenTargetId || null,
    ghostMessageSent: player.ghostMessageSent || false,
    resurrectorAngelUsed: player.resurrectorAngelUsed || false,
    bansheeScreams: player.bansheeScreams || {},
    bansheePoints: player.bansheePoints || 0,
    lookoutUsed: player.lookoutUsed || false,
    executionerTargetId: player.executionerTargetId || null,
    secretObjectiveId: player.secretObjectiveId || null,
    seerChecks: player.seerChecks || [],
  };

  return { publicData, privateData };
}
