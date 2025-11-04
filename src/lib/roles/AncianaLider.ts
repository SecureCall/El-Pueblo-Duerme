
import type { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";


export class AncianaLider implements IRole {
  readonly name = PlayerRoleEnum.enum.elder_leader;
  readonly description = "Cada noche eliges a un jugador para exiliarlo la próxima noche (no podrá usar habilidades).";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'elder_leader_exile' || !action.targetId) {
      return null;
    }
    
    return {
      game: {
        exiledPlayerId: action.targetId,
      },
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    return false;
  }

  getWinMessage(player: Player): string {
      return "El pueblo ha ganado.";
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
