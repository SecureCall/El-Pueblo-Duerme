
import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Cupido implements IRole {
  readonly name = PlayerRoleEnum.cupid;
  readonly description = "Solo en la primera noche, eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. Su objetivo es sobrevivir juntos, por encima de todo.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos'; // Gana con el pueblo si los enamorados no ganan

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
       events: [{
          id: `evt_cupid_love_${Date.now()}`,
          gameId: context.game.id,
          round: context.game.currentRound,
          type: 'special',
          message: `Una flecha ha atravesado la noche, uniendo dos destinos para siempre.`,
          data: { 
            targetId: loverIds[0], // Event directed to both lovers
            secondaryTargetId: loverIds[1],
           },
          createdAt: new Date(),
        }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    // La victoria de los enamorados se comprueba en `checkGameOver`
    return false;
  }

  getWinMessage(player: Player): string {
      // Si Cupido es un enamorado y gana, este mensaje podría usarse, pero la lógica principal está en checkGameOver
      return "El amor ha triunfado.";
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
