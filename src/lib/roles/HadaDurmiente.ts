
import { GameContext, GameStateChange, IRole, RoleData, RoleName, Team } from "@/types";

export class HadaDurmiente implements IRole {
  readonly name = 'sleeping_fairy';
  readonly description = "Empiezas como Neutral. Si el Hada Buscadora (del equipo de los lobos) te encuentra, os unís. Vuestro objetivo es ser las últimas en pie.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction(): GameStateChange | null {
    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    const otherFairy = game.players.find(p => p.role === 'seeker_fairy');
    
    // Si las hadas se encontraron y ambas están vivas al final
    if (game.fairiesFound && player.isAlive && otherFairy?.isAlive) {
      const alivePlayers = game.players.filter(p => p.isAlive);
      // Ganan si son las únicas que quedan
      if (alivePlayers.length === 2) {
        return true;
      }
    }
    return false;
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
