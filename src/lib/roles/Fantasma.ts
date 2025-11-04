
import { GameStateChange, IRole, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Fantasma implements IRole {
  readonly name = PlayerRoleEnum.GHOST;
  readonly description = "Si mueres, puedes enviar un único mensaje anónimo a un jugador vivo para intentar guiarlo desde el más allá.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(): GameStateChange | null {
    return null;
  }

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
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
}
