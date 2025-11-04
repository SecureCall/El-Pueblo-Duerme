
import type { IRole, RoleData, GameStateChange, Player, GameContext } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Aldeano implements IRole {
  readonly name = PlayerRoleEnum.enum.villager;
  readonly description = "No tienes poderes especiales. Tu única misión es observar, debatir y votar para linchar a los Hombres Lobo y salvar al pueblo.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext): GameStateChange | null {
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
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
