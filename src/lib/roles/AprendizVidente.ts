

import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player, PlayerRoleEnum } from "@/types";
import { Vidente } from "./Vidente";

export class AprendizVidente implements IRole {
  readonly name = PlayerRoleEnum.seer_apprentice;
  readonly description = "Mientras la vidente siga con vida, no tienes acciones especiales. Pero si la vidente muere, tomarás su lugar y comenzarás a investigar cada noche.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';
  private videnteLogic = new Vidente();

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    // Solo actúa si la vidente original ha muerto
    if (context.game.seerDied) {
      return this.videnteLogic.performNightAction(context, action);
    }
    return null;
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
