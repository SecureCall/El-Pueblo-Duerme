"use client";
import { useGameStore } from "@/store/useGameStore";
import { PlayerList } from "./PlayerList";
import { Chat } from "./Chat";
import { socket } from "@/lib/socket";

export function DayPhase() {
    const { room, players } = useGameStore();

    const handleVote = (targetId: string) => {
        if (room) {
            socket.emit("vote", { roomId: room.id, targetId });
        }
    };
    
    const myPlayer = players.find(p => p.id === socket.id);

    return (
        <div className="text-center">
            <h2 className="text-3xl font-bold font-serif mb-4">El Pueblo Despierta</h2>
            <p className="text-lg mb-6">El sol sale. Es hora de debatir y votar quién es el lobo...</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <h3 className="text-2xl font-bold mb-4">Votar para Linchar</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                         {players.filter(p => p.isAlive).map(player => (
                            <button
                                key={player.id}
                                onClick={() => handleVote(player.id)}
                                disabled={!myPlayer?.isAlive || myPlayer?.votedFor !== null}
                                className="p-4 bg-gray-700 rounded-lg hover:bg-red-800 disabled:bg-gray-600/50 disabled:cursor-not-allowed transition-colors"
                            >
                                {player.name}
                                {myPlayer?.votedFor === player.id && " (Votado)"}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                     <h3 className="text-2xl font-bold mb-4">Chat</h3>
                    <Chat />
                </div>
            </div>
        </div>
    );
}
