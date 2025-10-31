
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
    // Handle native Date objects
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
                 const value = data[key];
                // Firestore does not allow 'undefined' values.
                // We shouldn't have them, but this prevents errors if they sneak in.
                if (value !== undefined) {
                    newObj[key] = toPlainObject(value);
                }
            }
        }
        return newObj;
    }
    // Return primitives directly
    return data;
};

export const getMillis = (timestamp: any): number => {
    if (!timestamp) return 0;

    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    // Handle the object format that Timestamps become after JSON serialization (not toPlainObject)
    if (typeof timestamp === 'object' && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
        return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
    }
     // Handle the ISO string format from toPlainObject
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    if (typeof timestamp === 'number') {
        return timestamp; // It might already be in milliseconds
    }
    
    console.warn("Could not convert timestamp to milliseconds:", timestamp);
    return 0;
};

    