
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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


// This function is the single source of truth for converting Firestore data to plain objects.
// It's crucial for preventing the "Maximum call stack size exceeded" error.
export const toPlainObject = (data: any): any => {
    if (data === undefined || data === null) {
        return data;
    }
    // Firestore Timestamps have a toDate method
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    if (data instanceof Date) {
        return data.toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(item => toPlainObject(item));
    }
    if (typeof data === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in data) {
            // Ensure we are not iterating over prototype properties
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObj[key] = toPlainObject(data[key]);
            }
        }
        return newObj;
    }
    // Return primitives directly
    return data;
};
