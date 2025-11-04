
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class LiderCulto implements IRole {
  readonly name = PlayerRoleEnum.CULT_LEADER;
  readonly description = "Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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
    const alivePlayers = game.players.filter((p:Player) => p.isAlive);
    const allAreMembers = alivePlayers.every((p:Player) => p.isCultMember);
    return alivePlayers.length > 0 && allAreMembers;
  }

  getWinMessage(player: Player): string {
      return "¡El Culto ha ganado!";
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
