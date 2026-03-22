"use client";
import { GamePlay } from "@/components/game/GamePlay";

export default function PlayPage({ params }: { params: { gameId: string } }) {
  return <GamePlay gameId={params.gameId} />;
}
