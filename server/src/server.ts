import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { handleConnection } from './game';
import { setRoom } from './room-manager';
import type { Room, Player } from '@/types';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on('connection', (socket: Socket) => {
  try {
    console.log(`Socket conectado: ${socket.id}`);
    
    handleConnection(io, socket);

    socket.on('createRoom', async ({ userName }: { userName: string }) => {
      try {
        console.log(`Petición para crear sala recibida del usuario: ${userName}`);
        
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();

        const newRoom: Room = {
          id: roomId,
          players: [],
          gameState: {
            phase: 'waiting',
            round: 0,
            isDay: true,
          },
        };
        
        const player: Player = { id: socket.id, name: userName, isHost: true, isAlive: true, role: null, votedFor: null, votes: 0 };
        newRoom.players.push(player);

        await setRoom(roomId, newRoom);

        socket.join(roomId);

        socket.emit('roomCreated', { roomId });
        
        console.log(`Sala ${roomId} creada y jugador ${userName} unido.`);

      } catch (error) {
        console.error('Error al crear la sala:', error);
        socket.emit('gameError', 'No se pudo crear la sala.');
      }
    });

  } catch (error) {
    console.error("Error en el manejador principal de 'connection':", error);
    socket.emit('gameError', 'Ha ocurrido un error inesperado en el servidor.');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
