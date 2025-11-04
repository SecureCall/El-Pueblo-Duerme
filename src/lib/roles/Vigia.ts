

import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Vigia implements IRole {
  readonly name = PlayerRoleEnum.enum.lookout;
  readonly description = "Una vez por partida, puedes espiar a un jugador por la noche. Descubrirás a todos los que lo visiten, pero si los lobos te atacan esa misma noche, morirás antes de ver nada.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'lookout_spy') {
      return null;
    }
    
    // The core logic is handled in processNight. This just marks the ability as used.
    return {
      playerUpdates: [{ userId: context.player.userId, lookoutUsed: true }],
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
