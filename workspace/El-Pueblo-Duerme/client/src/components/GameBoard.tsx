"use client";
import { useGameStore } from '@/store/useGameStore';
import { PlayerList } from './PlayerList';
import { Chat } from './Chat';
import { RoleCard } from './RoleCard';
import { NightPhase } from './NightPhase';
import { DayPhase } from './DayPhase';
import { VotingPhase } from './VotingPhase';
import { GameOver } from './GameOver';

export function GameBoard() {
  const { gameState, myRole } = useGameStore();

  const renderPhaseComponent = () => {
    switch (gameState.phase) {
      case 'night':
        return <NightPhase />;
      case 'day':
        return <DayPhase />;
      case 'voting':
        return <VotingPhase />;
      case 'finished':
          return <GameOver />;
      default:
        return <div>Fase desconocida...</div>;
    }
  };

  return (
    <div className="w-full">
        {myRole && <RoleCard role={myRole} />}
        {renderPhaseComponent()}
    </div>
  );
}
