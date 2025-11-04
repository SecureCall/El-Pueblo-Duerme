
import { GameStateChange, IRole, RoleData } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Alborotadora implements IRole {
  readonly name = PlayerRoleEnum.TROUBLEMAKER;
  readonly description = "Una vez por partida, puedes provocar una pelea mortal entre dos jugadores, lo que causará que ambos sean eliminados inmediatamente.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(): GameStateChange | null {
    // La Alborotadora no actúa de noche
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    // Gana con los aldeanos
    return false;
  }

  getWinMessage() {
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
