
import { GameRoom } from "@/components/game/GameRoom";

export default async function GamePage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  return (
    <GameRoom gameId={gameId} />
  );
}
