
import { GameStateChange, IRole, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Alborotadora implements IRole {
  readonly name = PlayerRoleEnum.enum.troublemaker;
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
