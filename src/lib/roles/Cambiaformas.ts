
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Cambiaformas implements IRole {
  readonly name = 'shapeshifter';
  readonly description = "Te despiertas solo la primera noche para elegir a una persona. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente en ella.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.currentRound !== 1 || action.actionType !== 'shapeshifter_select' || !action.targetId) {
      return null;
    }
    
    return {
      playerUpdates: [{
        userId: context.player.userId,
        shapeshifterTargetId: action.targetId as string,
      }]
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
