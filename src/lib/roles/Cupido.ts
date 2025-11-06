import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team, Alliance } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Cupido implements IRole {
  readonly name = PlayerRoleEnum.cupid;
  readonly description = "Solo en la primera noche, eliges a dos jugadores para que se enamoren. Si uno de ellos muere, el otro morirá también. Su objetivo es sobrevivir juntos, por encima de todo.";
  readonly team: Team = 'Neutral';
  readonly alliance: Alliance = 'Neutral'; // Gana con los enamorados si ellos ganan

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

  checkWinCondition(context: GameContext): boolean {
    const { game } = context;
    if (!game.lovers) return false;
    
    const alivePlayers = game.players.filter(p => p.isAlive);
    const aliveLovers = alivePlayers.filter(p => game.lovers?.includes(p.userId));

    return aliveLovers.length === 2 && alivePlayers.length === 2;
  }

  getWinMessage(player: Player): string {
      return "¡El amor ha triunfado! Los enamorados son los únicos supervivientes y ganan la partida.";
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
