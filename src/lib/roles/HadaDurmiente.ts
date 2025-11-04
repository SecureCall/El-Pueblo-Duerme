
import { GameContext, GameStateChange, IRole, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class HadaDurmiente implements IRole {
  readonly name = PlayerRoleEnum.SLEEPING_FAIRY;
  readonly description = "Empiezas como Neutral. Si el Hada Buscadora (del equipo de los lobos) te encuentra, os unís. Vuestro objetivo es ser las últimas en pie.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    const otherFairy = game.players.find((p: Player) => p.role === 'seeker_fairy');
    
    // Si las hadas se encontraron y ambas están vivas al final
    if (game.fairiesFound && player.isAlive && otherFairy?.isAlive) {
      const alivePlayers = game.players.filter((p: Player) => p.isAlive);
      // Ganan si son las únicas que quedan
      if (alivePlayers.length === 2) {
        return true;
      }
    }
    return false;
  }
  
  getWinMessage(player: Player): string {
    return "Las Hadas han ganado.";
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
