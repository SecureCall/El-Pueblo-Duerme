
'use client';
import { GameRoom } from '@/components/game/GameRoom';

export default function GamePage({ params }: { params: { gameId: string } }) {
  const gameId = params.gameId ? params.gameId.toUpperCase() : '';
  
  if (!gameId) {
    // Optionally handle the case where gameId is not present,
    // e.g., show a loading spinner or an error message.
    return <div>Cargando...</div>;
  }
  
  return <GameRoom gameId={gameId} />;
}
