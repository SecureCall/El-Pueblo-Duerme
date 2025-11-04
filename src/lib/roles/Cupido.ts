
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Cupido implements IRole {
  readonly name = 'cupid';
  readonly description = "Solo te despiertas la primera noche. Eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. El amor no entiende de bandos.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos'; // Gana con el pueblo si los enamorados no ganan

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.currentRound !== 1 || action.actionType !== 'cupid_love' || !action.targetId) {
      return null;
    }

    const loverIds = (action.targetId as string).split('|');
    if (loverIds.length !== 2) return null;

    const playerUpdates = context.players.map(p => {
      if (loverIds.includes(p.userId)) {
        return { ...p, isLover: true };
      }
      return p;
    });

    return {
      game: {
        lovers: loverIds as [string, string],
      },
      playerUpdates,
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    // El objetivo principal de Cupido es que ganen los enamorados.
    // Si los enamorados ganan, Cupido no gana.
    // Si los enamorados mueren y Cupido sobrevive, gana con los aldeanos.
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
