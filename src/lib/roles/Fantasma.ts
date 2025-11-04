
import { GameStateChange, IRole, RoleData } from "@/types";

export class Fantasma implements IRole {
  readonly name = 'ghost';
  readonly description = "Si mueres, puedes enviar un único mensaje anónimo a un jugador vivo para intentar guiarlo desde el más allá.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  toJSON(): RoleData {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }

  onNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    return false;
  }
}

    