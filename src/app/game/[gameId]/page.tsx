
import { GameRoom } from "@/components/game/GameRoom";

export default function GamePage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  return (
    <GameRoom gameId={gameId} />
  );
}
