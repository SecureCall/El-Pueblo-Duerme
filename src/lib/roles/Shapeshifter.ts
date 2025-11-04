

import { GameContext, GameStateChange, IRole, NightAction, RoleData, PlayerRoleEnum } from "@/types";

export class Cambiaformas implements IRole {
  readonly name = PlayerRoleEnum.enum.shapeshifter;
  readonly description = "Te despiertas solo la primera noche para elegir a una persona. Si esa persona muere, adoptarás su rol y su equipo, transformándote completamente en ella.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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
    // The win condition depends on the role they transform into.
    return false;
  }

  getWinMessage() {
      return "El Cambiaformas ha ganado de una forma misteriosa...";
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
