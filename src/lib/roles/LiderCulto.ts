
import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class LiderCulto implements IRole {
  readonly name = PlayerRoleEnum.enum.cult_leader;
  readonly description = "Cada noche, conviertes a un jugador a tu culto. Ganas si todos los jugadores vivos se han unido a tu culto. Juegas solo contra todos.";
  readonly team: Team = 'Neutral';
  readonly alliance: Team = 'Neutral';

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

  onDeath(context: GameContext): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game } = context;
    const alivePlayers = game.players.filter((p:Player) => p.isAlive);
    if (alivePlayers.length === 0) return false;
    const allAreMembers = alivePlayers.every((p:Player) => p.isCultMember);
    return allAreMembers;
  }

  getWinMessage(player: Player): string {
      return "¡El Culto ha ganado! Todos los supervivientes se han unido a la sombra del Líder.";
  }
  
  toJSON() {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
