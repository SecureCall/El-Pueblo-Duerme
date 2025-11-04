
import { GameStateChange, IRole, RoleData, RoleName, Team } from "@/types";

export class Alborotadora implements IRole {
  readonly name = 'troublemaker';
  readonly description = "Una vez por partida, puedes provocar una pelea mortal entre dos jugadores, lo que causará que ambos sean eliminados inmediatamente.";
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
}
