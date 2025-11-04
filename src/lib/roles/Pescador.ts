
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Pescador implements IRole {
  readonly name = 'fisherman';
  readonly description = "Cada noche, subes a un jugador a tu barco. Ganas si logras tener a todos los aldeanos vivos en tu barco. Pero si pescas a un lobo, mueres.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'fisherman_catch' || !action.targetId) {
      return null;
    }

    const targetPlayer = context.players.find(p => p.userId === action.targetId);
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

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { game, player } = context;
    if (!player.isAlive || !game.boat) return false;

    const wolfRoles: RoleName[] = ['werewolf', 'wolf_cub', 'cursed', 'seeker_fairy', 'witch'];
    
    const aliveVillagers = game.players.filter(p => 
      p.isAlive && p.team === 'Aldeanos' && !wolfRoles.includes(p.role)
    );
    
    const allVillagersInBoat = aliveVillagers.every(v => game.boat.includes(v.userId));
    
    return aliveVillagers.length > 0 && allVillagersInBoat;
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
