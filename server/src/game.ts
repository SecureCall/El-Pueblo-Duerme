import { Server, Socket } from 'socket.io';
import { getRoom, setRoom } from './room-manager';
import { Room, Player, GameState, PlayerAction } from '@/types';
import { assignRoles } from './roles';
import { ROLES } from './roles';

// Helper function to broadcast updates to a room
async function updateRoom(io: Server, roomId: string) {
  const room = await getRoom(roomId);
  if (room) {
    io.to(roomId).emit('roomUpdate', room);
  }
}

// Validation Middleware (conceptual)
async function validateAction(socketId: string, roomId: string): Promise<{ valid: boolean; message: string; room: Room | null; player: Player | undefined }> {
    const room = await getRoom(roomId);
    if (!room) {
        return { valid: false, message: 'La sala no existe.', room: null, player: undefined };
    }

    const player = room.players.find(p => p.id === socketId);
    if (!player) {
        return { valid: false, message: 'No eres un jugador en esta sala.', room, player: undefined };
    }

    if (!player.isAlive) {
        return { valid: false, message: 'Los muertos no pueden realizar acciones.', room, player };
    }
    
    return { valid: true, message: 'Acción válida.', room, player };
}


export function handleConnection(io: Server, socket: Socket) {
  
  socket.on('joinRoom', async ({ roomId }: { roomId: string }, callback) => {
    try {
        const room = await getRoom(roomId);
        if (room) {
          socket.join(roomId);
          socket.emit('roomUpdate', room);
          callback({ success: true });
        } else {
          callback({ success: false, error: 'La sala no existe.' });
        }
    } catch (error) {
        console.error(`Error en el evento 'joinRoom' para la sala ${roomId}:`, error);
        callback({ success: false, error: 'Ha ocurrido un error interno en el servidor.' });
    }
  });

  socket.on('startGame', async ({ roomId }: { roomId: string }) => {
    try {
        const { valid, message, room, player } = await validateAction(socket.id, roomId);
        if (!valid || !room || !player) {
            socket.emit('gameError', message);
            return;
        }

        if (player.isHost && room.players.length >= 3) {
          assignRoles(room);
          room.gameState.phase = 'night'; // Start the game
          await setRoom(roomId, room);
          
          room.players.forEach(p => {
            io.to(p.id).emit('roleAssigned', p.role);
          });
          
          await updateRoom(io, roomId);
        }
    } catch (error) {
        console.error(`Error en el evento 'startGame' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'Ha ocurrido un error al iniciar la partida.');
    }
  });
  
  socket.on('chatMessage', async ({ roomId, message }: { roomId: string; message: string }) => {
    try {
        const { valid, room, player } = await validateAction(socket.id, roomId);
        if (!valid || !room || !player) return;

        const chatMessage = { sender: player.name, text: message, type: 'player' as const };
        io.to(roomId).emit('chatMessage', chatMessage);
    } catch (error) {
        console.error(`Error en el evento 'chatMessage' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'No se pudo enviar tu mensaje.');
    }
  });

  socket.on('playerAction', async ({ roomId, action }: { roomId: string, action: PlayerAction }) => {
    try {
        const { valid, message, room, player } = await validateAction(socket.id, roomId);
        if (!valid || !room || !player) {
            socket.emit('gameError', message);
            return;
        }
        
        if (room.gameState.phase !== 'night' || player.role?.id !== action.role) {
            socket.emit('gameError', 'No puedes realizar esa acción ahora.');
            return;
        }


        // --- Logic for player actions ---
        console.log(`Acción recibida del jugador ${player.name}:`, action);

        if(action.role === 'werewolf' && action.target) {
            const targetPlayer = room.players.find(p => p.id === action.target);
            if(targetPlayer) {
                console.log(`Lobo ${player.name} ha votado para matar a ${targetPlayer.name}`);
                // In a real game, you'd collect votes, not kill instantly.
            }
        }
        
        socket.emit('actionConfirmation');

    } catch (error) {
        console.error(`Error en el evento 'playerAction' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'Ha ocurrido un error al procesar tu acción.');
    }
  });

  socket.on('disconnect', async () => {
    try {
      console.log(`Socket desconectado: ${socket.id}`);
      // This is complex with an external store. The user needs to be removed from the room state in Redis.
      // For now, this logic will be simplified. A full implementation requires tracking which room a socket is in.
    } catch(error) {
        console.error("Error en el manejador de 'disconnect':", error);
    }
  });
}
