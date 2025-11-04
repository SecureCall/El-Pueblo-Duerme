
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";

export class Cupido implements IRole {
  readonly name = 'cupid';
  readonly description = "Solo te despiertas la primera noche. Eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. El amor no entiende de bandos.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos'; // Gana con el pueblo si los enamorados no ganan

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.currentRound !== 1 || action.actionType !== 'cupid_love' || !action.targetId) {
      return null;
    }

    const loverIds = (action.targetId as string).split('|');
    if (loverIds.length !== 2) return null;

    const playerUpdates: Partial<Player>[] = loverIds.map(id => ({ userId: id, isLover: true }));

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

  getWinMessage(player: Player): string {
      return "El pueblo ha ganado."
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
