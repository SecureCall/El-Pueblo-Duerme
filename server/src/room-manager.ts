import { createClient } from 'redis';
import type { Room } from '@/types';

// This would connect to your Redis instance.
// For local development, it connects to redis://localhost:6379 by default.
// For production, you'd use a connection string from an environment variable.
const redisClient = createClient({
    // url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis once when the server starts.
redisClient.connect();


/**
 * Saves the entire state of a room to Redis.
 * @param roomId The ID of the room.
 * @param room The room object to save.
 */
export async function setRoom(roomId: string, room: Room): Promise<void> {
    const key = `room:${roomId}`;
    await redisClient.set(key, JSON.stringify(room));
}

/**
 * Retrieves the entire state of a room from Redis.
 * @param roomId The ID of the room.
 * @returns The room object, or null if it doesn't exist.
 */
export async function getRoom(roomId: string): Promise<Room | null> {
    const key = `room:${roomId}`;
    const roomJSON = await redisClient.get(key);
    return roomJSON ? JSON.parse(roomJSON) : null;
}

/**
 * Deletes a room from Redis.
 * @param roomId The ID of the room to delete.
 */
export async function deleteRoom(roomId: string): Promise<void> {
    const key = `room:${roomId}`;
    await redisClient.del(key);
}
