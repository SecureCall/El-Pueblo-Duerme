
import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class HadaBuscadora implements IRole {
  readonly name = PlayerRoleEnum.seeker_fairy;
  readonly description = "Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.";
  readonly team: Team = 'Lobos';
  readonly alliance: Team = 'Lobos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType === 'fairy_find' && !context.game.fairiesFound) {
      const targetPlayer = context.players.find(p => p.userId === action.targetId);
      if (targetPlayer?.role === 'sleeping_fairy') {
        return {
          game: { fairiesFound: true },
          playerUpdates: [{ userId: targetPlayer.userId, alliance: 'Lobos' }],
          events: [{
            id: `evt_fairy_found_${Date.now()}`,
            gameId: context.game.id,
            round: context.game.currentRound,
            type: 'special',
            message: '¡Las hadas se han encontrado! Un nuevo poder oscuro ha despertado.',
            data: { targetId: context.player.userId, secondaryTargetId: targetPlayer.userId },
            createdAt: new Date(),
          }]
        };
      }
      return null; // Search continues
    }

    if (action.actionType === 'fairy_kill' && context.game.fairiesFound && !context.game.fairyKillUsed) {
      return {
        game: { fairyKillUsed: true },
        pendingDeaths: [{ playerId: action.targetId as string, cause: 'special' }]
      };
    }

    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    if (!game.fairiesFound || !game.fairyKillUsed) return false;
    
    const otherFairy = game.players.find((p: Player) => p.role === 'sleeping_fairy');
    
    if (player.isAlive && otherFairy?.isAlive) {
       return true;
    }

    return false;
  }
  
  getWinMessage(player: Player): string {
    return "¡Las Hadas han ganado! Han lanzado su maldición y cumplido su misterioso objetivo.";
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
