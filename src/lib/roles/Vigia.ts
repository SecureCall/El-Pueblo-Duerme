
import { GameContext, GameStateChange, IRole, NightAction, RoleData } from "@/types";

export class Vigia implements IRole {
  readonly name = 'lookout';
  readonly description = "Una vez por partida, puedes espiar a un jugador por la noche. Descubrirás a todos los que lo visiten, pero si los lobos te atacan esa misma noche, morirás antes de ver nada.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}

    