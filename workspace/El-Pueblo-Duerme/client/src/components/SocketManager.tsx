"use client";

import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import { useGameStore } from '@/store/useGameStore';
import toast from 'react-hot-toast';
import { Player, Room, GameState, ChatMessage, Role } from '@/types';
import { useRouter } from 'next/navigation';

export function SocketManager() {
  const router = useRouter();
  const { 
    setRoom, 
    setPlayers, 
    addPlayer, 
    removePlayer,
    updatePlayer,
    setGameState,
    addChatMessage,
    setMyRole,
    setError
  } = useGameStore();

  useEffect(() => {
    // Only run this on the client
    if (typeof window === 'undefined') return;

    // Connect the socket when the component mounts
    socket.connect();

    // --- Event Listeners ---
    
    function onConnect() {
      console.log('Connected to socket server');
      setError(null);
    }
    
    function onDisconnect() {
      console.log('Disconnected from socket server');
      toast.error('Desconectado del servidor.');
    }

    function onRoomUpdate(room: Room) {
      setRoom(room);
      setPlayers(room.players);
      setGameState(room.gameState);
    }
    
    function onRoomCreated(data: { roomId: string }) {
      console.log('Server created room, redirecting to:', data.roomId);
      router.push(`/room/${data.roomId}`);
    }

    function onPlayerJoined(player: Player) {
      addPlayer(player);
      toast(`${player.name} se ha unido a la sala.`);
    }

    function onPlayerLeft(playerId: string) {
      const leavingPlayer = useGameStore.getState().players.find(p => p.id === playerId);
      if(leavingPlayer) {
        toast(`${leavingPlayer.name} ha abandonado la sala.`);
      }
      removePlayer(playerId);
    }

    function onPlayerStateUpdate(player: Player) {
        updatePlayer(player);
    }

    function onGameStateUpdate(gameState: GameState) {
        setGameState(gameState);
    }

    function onChatMessage(message: ChatMessage) {
        addChatMessage(message);
    }
    
    function onRoleAssigned(role: any) {
        setMyRole(role);
        toast.success(`Tu rol es: ${role.name}`, { duration: 5000 });
    }

    function onError(message: string) {
        setError(message);
        toast.error(message);
    }

    // --- Register Listeners ---
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomUpdate', onRoomUpdate);
    socket.on('roomCreated', onRoomCreated);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('playerStateUpdate', onPlayerStateUpdate);
    socket.on('gameStateUpdate', onGameStateUpdate);
    socket.on('chatMessage', onChatMessage);
    socket.on('roleAssigned', onRoleAssigned);
    socket.on('error', onError);

    // --- Cleanup ---
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomUpdate', onRoomUpdate);
      socket.off('roomCreated', onRoomCreated);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('playerStateUpdate', onPlayerStateUpdate);
      socket.off('gameStateUpdate', onGameStateUpdate);
      socket.off('chatMessage', onChatMessage);
      socket.off('roleAssigned', onRoleAssigned);
      socket.off('error', onError);
      
      // Disconnect when the main component unmounts (e.g., user closes tab)
      socket.disconnect();
    };
  }, [setRoom, setPlayers, addPlayer, removePlayer, updatePlayer, setGameState, addChatMessage, setMyRole, setError, router]);

  // This component doesn't render anything
  return null;
}
