
import { GameContext, GameStateChange, IRole, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Leprosa implements IRole {
  readonly name = PlayerRoleEnum.LEPROSA;
  readonly description = "Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction() {
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    // El efecto se activa si la causa de la muerte es un ataque de lobo
    // Esta lógica se maneja en el game loop principal al procesar la muerte
    return {
      game: {
        leprosaBlockedRound: context.game.currentRound + 1
      }
    };
  }

  checkWinCondition() {
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
