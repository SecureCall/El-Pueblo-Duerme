import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  if (typeof timestamp === 'object' && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
    return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
  }
  if (timestamp instanceof Date) {
      return timestamp.getTime();
  }
  if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
          return date.getTime();
      }
  }
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

