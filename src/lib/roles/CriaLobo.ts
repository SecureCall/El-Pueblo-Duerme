
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Team } from "@/types";

export class CriaLobo implements IRole {
  readonly name = 'wolf_cub';
  readonly description = "Si eres eliminado, la noche siguiente a tu muerte, los lobos devorarán a dos personas en lugar de una.";
  readonly team = 'Lobos';
  readonly alliance = 'Lobos';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
