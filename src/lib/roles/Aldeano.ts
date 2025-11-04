
import type { IRole, RoleData, GameStateChange, PlayerRoleEnum } from "@/types";

export class Aldeano implements IRole {
  readonly name = PlayerRoleEnum.VILLAGER;
  readonly description = "No tienes poderes especiales. Tu única misión es observar, debatir y votar para linchar a los Hombres Lobo y salvar al pueblo.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    return false;
  }

  getWinMessage(player: import("@/types").Player): string {
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
