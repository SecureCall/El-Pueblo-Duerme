

import { GameContext, GameStateChange, IRole, Player, RoleData } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class CriaLobo implements IRole {
  readonly name = PlayerRoleEnum.wolf_cub;
  readonly description = "Si eres eliminado, la noche siguiente a tu muerte, los lobos devorarán a dos personas en lugar de una.";
  readonly team = 'Lobos';
  readonly alliance = 'Lobos';

  performNightAction(): GameStateChange | null {
    // La Cría de Lobo no tiene una acción propia, participa en la de los lobos
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    return {
      game: {
        wolfCubRevengeRound: context.game.currentRound,
      },
    };
  }

  checkWinCondition(): boolean {
    // Gana con los lobos
    return false;
  }

  getWinMessage(player: Player): string {
    return "Los lobos han ganado.";
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
