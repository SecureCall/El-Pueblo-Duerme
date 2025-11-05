

import { GameContext, GameStateChange, IRole, NightAction, Player, PlayerRole, Team, Alliance } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Pescador implements IRole {
  readonly name = PlayerRoleEnum.fisherman;
  readonly description = "Cada noche, subes a un jugador a tu barco. Ganas si logras tener a todos los aldeanos vivos en tu barco. Pero si pescas a un lobo, mueres.";
  readonly team: Team = 'Neutral';
  readonly alliance: Alliance = 'Neutral';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'fisherman_catch' || !action.targetId) {
      return null;
    }

    const targetPlayer = context.players.find((p: Player) => p.userId === action.targetId);
    if (!targetPlayer) return null;

    if (targetPlayer.role === 'werewolf' || targetPlayer.role === 'wolf_cub') {
      return {
        pendingDeaths: [{ playerId: context.player.userId, cause: 'special' }]
      };
    }

    const newBoat = [...(context.game.boat || []), action.targetId as string];
    return {
      game: {
        boat: newBoat,
      }
    };
  }

  onDeath(context: GameContext): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    if (!player.isAlive || !game.boat) return false;

    const wolfRoles: PlayerRole[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
    
    const aliveVillagers = game.players.filter((p: Player) => 
      p.isAlive && p.role && !wolfRoles.includes(p.role)
    );
    
    const allVillagersInBoat = aliveVillagers.every((v: Player) => game.boat.includes(v.userId));
    
    return aliveVillagers.length > 0 && allVillagersInBoat;
  }

  getWinMessage(player: Player): string {
    return "¡El Pescador ha ganado!";
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
