
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class LiderCulto implements IRole {
  readonly name = 'cult_leader';
  readonly description = "Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'cult_recruit' || !action.targetId) {
      return null;
    }

    return {
      playerUpdates: [{
        userId: action.targetId as string,
        isCultMember: true,
      }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game } = context;
    const alivePlayers = game.players.filter(p => p.isAlive);
    const allAreMembers = alivePlayers.every(p => p.isCultMember);
    return alivePlayers.length > 0 && allAreMembers;
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
