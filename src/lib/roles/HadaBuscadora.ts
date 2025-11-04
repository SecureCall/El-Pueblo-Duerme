
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class HadaBuscadora implements IRole {
  readonly name = PlayerRoleEnum.SEEKER_FAIRY;
  readonly description = "Equipo de los Lobos. Cada noche, buscas al Hada Durmiente. Si la encuentras, ambas despertáis un poder de un solo uso para matar a un jugador.";
  readonly team = 'Lobos';
  readonly alliance = 'Lobos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (context.game.fairiesFound) {
      if (action.actionType === 'fairy_kill' && !context.game.fairyKillUsed) {
        return {
          game: { fairyKillUsed: true },
          pendingDeaths: [{ playerId: action.targetId as string, cause: 'special' }]
        };
      }
      return null;
    }

    if (action.actionType !== 'fairy_find' || !action.targetId) {
      return null;
    }

    const targetPlayer = context.players.find((p: Player) => p.userId === action.targetId);
    if (targetPlayer?.role === 'sleeping_fairy') {
      const sleepingFairyIndex = context.players.findIndex((p:Player) => p.userId === targetPlayer.userId);
      const seekerFairyIndex = context.players.findIndex((p:Player) => p.userId === context.player.userId);

      const playerUpdates: Partial<Player>[] = [];
      if (sleepingFairyIndex > -1) playerUpdates.push({ userId: targetPlayer.userId, alliance: 'Lobos' });
      
      return {
        game: {
          fairiesFound: true,
        },
        playerUpdates,
        events: [{
          id: `evt_fairy_found_${Date.now()}`,
          gameId: context.game.id,
          round: context.game.currentRound,
          type: 'special',
          message: `¡Las hadas se han encontrado! Un nuevo poder oscuro ha despertado.`,
          data: { targetId: context.player.userId },
          createdAt: new Date(),
        }]
      };
    }

    return {
       events: [{
        id: `evt_fairy_miss_${Date.now()}`,
        gameId: context.game.id,
        round: context.game.currentRound,
        type: 'special',
        message: `Buscas en vano. ${targetPlayer?.displayName || 'El objetivo'} no es el hada que buscas.`,
        data: { targetId: context.player.userId },
        createdAt: new Date(),
      }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    const otherFairy = game.players.find((p: Player) => p.role === 'sleeping_fairy');
    
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
