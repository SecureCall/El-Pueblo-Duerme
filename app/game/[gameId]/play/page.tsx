"use client";

import { GamePlay } from "@/components/game/play/GamePlay";

export default function PlayPage({ params }: { params: { gameId: string } }) {
  return <GamePlay gameId={params.gameId} />;
}
