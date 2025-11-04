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

// Usamos un Map para guardar las salas en memoria.
// En una aplicación real, esto debería estar en una base de datos más persistente como Redis.
export const rooms = new Map<string, Room>();

io.on('connection', (socket: Socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  
  // La lógica principal de conexión se ha movido a game.ts
  handleConnection(io, socket);

  socket.on('createRoom', ({ userName }: { userName: string }) => {
    try {
      console.log(`Petición para crear sala recibida del usuario: ${userName}`);
      
      // 1. Generar un ID de sala único
      const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();

      // 2. Crear la sala en la memoria del servidor
      const newRoom: Room = {
        id: roomId,
        players: [],
        gameState: {
          phase: 'waiting',
          round: 0,
          isDay: true,
        },
      };
      
      // Añadir al jugador que la creó
      const player: Player = { id: socket.id, name: userName, isHost: true, isAlive: true, role: null, votedFor: null, votes: 0 };
      newRoom.players.push(player);

      rooms.set(roomId, newRoom);

      // 3. Unir al socket actual a la sala de Socket.IO
      socket.join(roomId);

      // 4. Emitir el evento de vuelta al cliente para que pueda redirigir
      socket.emit('roomCreated', { roomId });
      
      console.log(`Sala ${roomId} creada y jugador ${userName} unido.`);

    } catch (error) {
      console.error('Error al crear la sala:', error);
      socket.emit('gameError', 'No se pudo crear la sala.');
    }
  });

});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
