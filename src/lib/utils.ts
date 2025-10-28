
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getMillis = (timestamp: any): number => {
    if (!timestamp) return 0;

    // Handle Firebase Timestamp object
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    // Handle serialized Firebase Timestamp object (from server)
    if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
    // Handle Date object
    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    // Handle ISO string
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    // Handle number (already in milliseconds)
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    
    console.warn("Could not convert timestamp to milliseconds:", timestamp);
    return 0;
};


export function toPlainObject<T>(obj: T): T {
    if (obj === undefined) {
        return null as any;
    }
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString() as any;
    }
    if (obj instanceof Date) {
        return obj.toISOString() as any;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => toPlainObject(item)) as any;
    }
    
    // This handles Firestore's Increment object by getting its operand
    if (typeof obj === 'object' && 'operand' in obj && typeof (obj as any)._methodName === 'string' && (obj as any)._methodName.includes('increment')) {
        return (obj as any).operand;
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

    