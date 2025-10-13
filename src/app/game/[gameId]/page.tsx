
import { GameRoom } from "@/components/game/GameRoom";

export default function GamePage({ params: { gameId } }: { params: { gameId: string } }) {
  return (
    <GameRoom gameId={gameId} />
  );
}
