"use client";
import { useGameStore } from "@/store/useGameStore";

export function VotingPhase() {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold font-serif mb-4">Resultados de la Votación</h2>
      <p className="text-lg">Contando los votos...</p>
      {/* This component will be updated with live voting results */}
    </div>
  );
}
