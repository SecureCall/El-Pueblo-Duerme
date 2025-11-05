
import { GameContext, GameStateChange, IRole, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Alborotadora implements IRole {
  readonly name = PlayerRoleEnum.troublemaker;
  readonly description = "Una vez por partida, puedes provocar una pelea mortal entre dos jugadores, lo que causará que ambos sean eliminados inmediatamente.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext): GameStateChange | null {
    // La Alborotadora no actúa de noche
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    // Gana con los aldeanos
    return false;
  }

  getWinMessage(player: Player): string {
      return "El pueblo ha ganado.";
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      team: this.team,
      alliance: this.alliance,
    };
  }
}
