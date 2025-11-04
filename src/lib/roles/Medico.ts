
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Medico implements IRole {
  readonly name = 'doctor';
  readonly description = "Cada noche, eliges a un jugador (o a ti mismo) para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'doctor_heal' || !action.targetId) {
      return null;
    }

    const { game, player } = context;
    const targetId = action.targetId as string;
    
    if (game.players.find(p => p.userId === targetId)?.lastHealedRound === game.currentRound - 1) {
      // This check should also be on the client to provide immediate feedback
      return null;
    }
    
    return {
      playerUpdates: [
        { userId: player.userId, usedNightAbility: true },
        { userId: targetId, lastHealedRound: game.currentRound }
      ],
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    return false;
  }

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
