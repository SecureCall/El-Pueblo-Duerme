"use client";

import { SecureGameRoomEntry } from "@/components/game/SecureGameRoomEntry";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return <SecureGameRoomEntry gameId={params.gameId} />;
}
