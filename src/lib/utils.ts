import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toPlainObject<T>(obj: T): any {
    if (obj === undefined || obj === null) {
        return null;
    }
    // Most specific check first: Firestore Timestamps
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    // Then check for standard Date objects
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => toPlainObject(item));
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = (obj as any)[key];
                // Recursively convert nested properties, excluding undefined
                if (value !== undefined) {
                    newObj[key] = toPlainObject(value);
                }
            }
        }
        return newObj;
    }
    // Return primitives and other types as-is
    return obj;
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
        // This is a plain object representation of a Firestore Timestamp
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
    
    console.warn("Could not convert timestamp to milliseconds:", timestamp);
    return 0;
};
