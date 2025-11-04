
import type { GameContext, GameStateChange, IRole, RoleData, PlayerRoleEnum } from "@/types";

export class Cazador implements IRole {
  readonly name = PlayerRoleEnum.HUNTER;
  readonly description = "Si mueres, ya sea de noche o linchado de día, tendrás un último disparo. Deberás elegir a otro jugador para que muera contigo. Tu disparo es ineludible.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    return {
      game: {
        pendingHunterShot: context.player.userId,
      }
    };
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
