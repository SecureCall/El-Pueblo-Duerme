"use client";
import { useGameStore } from "@/store/useGameStore";

export function GameOver() {
  const { gameState } = useGameStore();

  return (
    <div className="text-center flex flex-col items-center justify-center h-full">
      <h1 className="text-5xl font-bold font-serif mb-4">¡Partida Terminada!</h1>
      <p className="text-2xl text-yellow-300">{gameState.winCondition}</p>
      {/* TODO: Add a button to return to the lobby or create a new game */}
    </div>
  );
}
