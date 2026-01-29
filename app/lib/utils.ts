
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";
import type { Player, PlayerPublicData, PlayerPrivateData } from "@/types";

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
    if (obj instanceof Timestamp) {
        return obj as any; 
    }
    if (obj instanceof Date) {
        return Timestamp.fromDate(obj) as any;
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
    joinedAt,
    votedFor: votedFor || null,
    lastActiveAt: lastActiveAt || null,
  };

  return { publicData, privateData: privateData as PlayerPrivateData };
}
