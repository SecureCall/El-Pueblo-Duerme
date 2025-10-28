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
