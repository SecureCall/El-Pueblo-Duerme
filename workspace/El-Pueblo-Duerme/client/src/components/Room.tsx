'use client';
import { useGameStore } from '@/store/useGameStore';
import { PlayerList } from './PlayerList';
import { Chat } from './Chat';
import { GameBoard } from './GameBoard';

export function Room() {
  const { room, players, gameState } = useGameStore();

  if (!room) {
    return <div>Cargando sala...</div>;
  }

  const isGameStarted = gameState.phase !== 'waiting';

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-2">{room.id}</h1>
      <p className="text-center text-gray-400 mb-6">
        {players.length} / 12 jugadores
      </p>

      {isGameStarted ? (
        <GameBoard />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-4">Jugadores</h2>
            <PlayerList />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">Chat de la Sala</h2>
            <Chat />
          </div>
        </div>
      )}
    </div>
  );
}
