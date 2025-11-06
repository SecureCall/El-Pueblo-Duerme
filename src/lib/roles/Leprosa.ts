
import { GameContext, GameStateChange, IRole, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Leprosa implements IRole {
  readonly name = PlayerRoleEnum.leprosa;
  readonly description = "Si los lobos te matan durante la noche, tu enfermedad se propaga a la manada, impidiéndoles atacar en la noche siguiente.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos';

  performNightAction() {
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    // This logic is now handled in the game engine when the cause of death is 'werewolf_kill'
    // to correctly apply the block for the *next* round.
    return null;
  }

  checkWinCondition() {
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
