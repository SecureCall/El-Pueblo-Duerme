
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Guardian implements IRole {
  readonly name = 'guardian';
  readonly description = "Cada noche, eliges a un jugador para protegerlo del ataque de los lobos. No puedes proteger a la misma persona dos noches seguidas, y solo puedes protegerte a ti mismo una vez por partida.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'guardian_protect' || !action.targetId) {
      return null;
    }
    
    const { game, player } = context;
    const targetId = action.targetId;

    if (targetId === player.userId) {
      if ((player.guardianSelfProtects || 0) >= 1) {
        // This validation should ideally be client-side too
        return null;
      }
      return {
        playerUpdates: [
          { userId: player.userId, guardianSelfProtects: (player.guardianSelfProtects || 0) + 1, usedNightAbility: true },
          { userId: targetId, lastHealedRound: game.currentRound }
        ],
      };
    } else {
      if (game.players.find(p => p.userId === targetId)?.lastHealedRound === game.currentRound - 1) {
        return null;
      }
      return {
        playerUpdates: [
          { userId: player.userId, usedNightAbility: true },
          { userId: targetId, lastHealedRound: game.currentRound }
        ],
      };
    }
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
