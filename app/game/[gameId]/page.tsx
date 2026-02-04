
"use client";

import { GameRoom } from "@/components/game/GameRoom";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return <GameRoom gameId={params.gameId.toUpperCase()} />;
}
