import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { handleConnection } from './game';
import type { Room } from './types';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

export const rooms = new Map<string, Room>();

io.on('connection', (socket: Socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  
  handleConnection(io, socket);

  socket.on('createRoom', ({ userName }: { userName: string }) => {
    try {
      console.log(`Petición para crear sala recibida del usuario: ${userName}`);
      
      // 1. Generate a unique room ID
      const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();

      // 2. Create the room object in server memory
      const newRoom: Room = {
        id: roomId,
        players: [],
        gameState: {
          phase: 'waiting',
          round: 0,
          isDay: true,
        },
      };
      
      // Add the creating player
      const player = { id: socket.id, name: userName, isHost: true, isAlive: true, role: null, votedFor: null, votes: 0 };
      newRoom.players.push(player);

      rooms.set(roomId, newRoom);

      // 3. Join the socket to the Socket.IO room
      socket.join(roomId);

      // 4. Emit the event back to the client so it can redirect
      socket.emit('roomCreated', { roomId });
      
      console.log(`Sala ${roomId} creada y jugador ${userName} unido.`);

    } catch (error) {
      console.error('Error al crear la sala:', error);
      socket.emit('error', { message: 'No se pudo crear la sala.' });
    }
  });

});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
