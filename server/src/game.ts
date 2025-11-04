import { Server, Socket } from 'socket.io';
import { rooms } from './server';
import { Room, Player, GameState, PlayerAction } from './types'; // Import from shared types
import { assignRoles } from './roles';
import { ROLES } from './roles';

// Helper function to broadcast updates to a room
function updateRoom(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit('roomUpdate', room);
  }
}

// Validation Middleware (conceptual)
function validateAction(socketId: string, roomId: string, action: PlayerAction): { valid: boolean; message: string; room: Room | undefined; player: Player | undefined } {
    const room = rooms.get(roomId);
    if (!room) {
        return { valid: false, message: 'La sala no existe.', room: undefined, player: undefined };
    }

    const player = room.players.find(p => p.id === socketId);
    if (!player) {
        return { valid: false, message: 'No eres un jugador en esta sala.', room, player: undefined };
    }

    if (!player.isAlive) {
        return { valid: false, message: 'Los muertos no pueden realizar acciones.', room, player };
    }
    
    // Add more checks based on game phase, player role, etc.
    // Example:
    // if (room.gameState.phase !== 'night' && action.role !== 'villager') {
    //     return { valid: false, message: 'No es el momento de realizar esta acción.', room, player };
    // }
    // if (player.role?.id !== action.role) {
    //     return { valid: false, message: 'No puedes realizar una acción que no corresponde a tu rol.', room, player };
    // }

    return { valid: true, message: 'Acción válida.', room, player };
}


export function handleConnection(io: Server, socket: Socket) {
  
  socket.on('joinRoom', ({ roomId }: { roomId: string }, callback) => {
    try {
        const room = rooms.get(roomId);
        if (room) {
          socket.join(roomId);
          // Send the full room state to the joining player
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

  socket.on('startGame', ({ roomId }: { roomId: string }) => {
    try {
        const room = rooms.get(roomId);
        if (room && room.players[0].id === socket.id && room.players.length >= 3) {
          assignRoles(room);
          room.gameState.phase = 'night'; // Start the game
          
          // Send each player their role individually
          room.players.forEach(p => {
            io.to(p.id).emit('roleAssigned', p.role);
          });
          
          updateRoom(io, roomId);
        }
    } catch (error) {
        console.error(`Error en el evento 'startGame' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'Ha ocurrido un error al iniciar la partida.');
    }
  });
  
  socket.on('chatMessage', ({ roomId, message }: { roomId: string; message: string }) => {
    try {
        const room = rooms.get(roomId);
        const player = room?.players.find(p => p.id === socket.id);
        if (room && player) {
          const chatMessage = { sender: player.name, text: message, type: 'player' as const };
          io.to(roomId).emit('chatMessage', chatMessage);
        }
    } catch (error) {
        console.error(`Error en el evento 'chatMessage' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'No se pudo enviar tu mensaje.');
    }
  });

  socket.on('playerAction', ({ roomId, action }: { roomId: string, action: PlayerAction }) => {
    try {
        const { valid, message, room, player } = validateAction(socket.id, roomId, action);
        if (!valid || !room || !player) {
            socket.emit('gameError', message);
            return;
        }

        // --- Logic for player actions ---
        // This is where you would process werewolf kills, seer checks, etc.
        console.log(`Acción recibida del jugador ${player.name}:`, action);

        // Example: Werewolf kill
        if(action.role === 'werewolf' && action.target) {
            const targetPlayer = room.players.find(p => p.id === action.target);
            if(targetPlayer) {
                console.log(`Lobo ${player.name} ha votado para matar a ${targetPlayer.name}`);
                // In a real game, you'd collect votes, not kill instantly.
            }
        }
        
        // Let the player know their action was received
        socket.emit('actionConfirmation');

    } catch (error) {
        console.error(`Error en el evento 'playerAction' para la sala ${roomId}:`, error);
        socket.emit('gameError', 'Ha ocurrido un error al procesar tu acción.');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
    // Find which room the player was in and remove them
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        // If the host disconnects, assign a new host
        if (room.players.length > 0 && room.players.every(p => !p.isHost)) {
            room.players[0].isHost = true;
        }
        
        if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Sala vacía ${roomId} eliminada.`);
        } else {
            io.to(roomId).emit('playerLeft', socket.id);
            updateRoom(io, roomId);
        }
        break;
      }
    }
  });
}
