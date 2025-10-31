import { io, Socket } from "socket.io-client";

// The URL of your server should come from an environment variable
const URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Create a single, shared socket instance
export const socket: Socket = io(URL, {
  autoConnect: false, // We will connect manually when needed
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
