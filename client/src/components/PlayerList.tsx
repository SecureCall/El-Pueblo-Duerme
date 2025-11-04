"use client";
import { useGameStore } from "@/store/useGameStore";
import { Crown, User } from "lucide-react";
import { socket } from "@/lib/socket";

export function PlayerList() {
  const { players, room } = useGameStore();

  const handleStartGame = () => {
    if (room) {
      socket.emit("startGame", { roomId: room.id });
    }
  };
  
  // This is a temporary way to identify the current player
  // In a real app, you'd use a session or auth token
  const myPlayerId = socket.id;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <ul className="space-y-3">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md"
          >
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-gray-400" />
              <span className="font-medium">{player.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {player.isHost && (
                <Crown className="h-5 w-5 text-yellow-400" title="Anfitrión" />
              )}
            </div>
          </li>
        ))}
      </ul>
      {players.find(p => p.id === myPlayerId)?.isHost && (
        <button
          onClick={handleStartGame}
          disabled={players.length < 3}
          className="mt-6 w-full px-6 py-3 rounded-md bg-green-600 text-white font-bold text-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          Comenzar Partida
        </button>
      )}
    </div>
  );
}
