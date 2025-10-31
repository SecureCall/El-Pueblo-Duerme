"use client";
import { useGameStore } from "@/store/useGameStore";
import { PlayerList } from "./PlayerList";
import { Chat } from "./Chat";
import { socket } from "@/lib/socket";

export function NightPhase() {
  const { myRole, players } = useGameStore();

  const handleAction = (targetId: string) => {
    socket.emit("playerAction", { role: myRole?.id, target: targetId });
  };
  
  const myPlayer = players.find(p => p.id === socket.id);

  if (!myPlayer || !myPlayer.isAlive) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Estás muerto</h2>
        <p>Observas desde el más allá...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold font-serif mb-4">La Noche Cae...</h2>
      
      {myRole?.hasNightAction ? (
        <div>
          <p className="text-lg mb-4">{myRole.actionPrompt}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {players.filter(p => p.isAlive && p.id !== myPlayer.id).map(player => (
              <button
                key={player.id}
                onClick={() => handleAction(player.id)}
                className="p-4 bg-gray-700 rounded-lg hover:bg-purple-800 transition-colors"
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-lg">Cierras los ojos y esperas al amanecer...</p>
      )}
    </div>
  );
}
