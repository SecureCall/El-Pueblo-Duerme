
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Banshee implements IRole {
  readonly name = 'banshee';
  readonly description = "Te despiertas una vez por partida para lanzar tu grito y señalar a un jugador. Si muere esa noche o al día siguiente, podrás lanzar un último grito en otra noche. Si aciertas ambas veces, ganas.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'banshee_scream' || !action.targetId) {
      return null;
    }
    
    const screams = { ...(context.player.bansheeScreams || {}) };
    screams[context.game.currentRound] = action.targetId;

    return {
      playerUpdates: [{
        userId: context.player.userId,
        bansheeScreams: screams,
      }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const { player, game } = context;
    if (!player.isAlive || !player.bansheeScreams) {
      return false;
    }
    
    const screams = Object.values(player.bansheeScreams);
    if (screams.length < 2) {
      return false;
    }

    const targets = screams.map(targetId => game.players.find(p => p.userId === targetId));
    const allTargetsAreDead = targets.every(target => target && !target.isAlive);

    return allTargetsAreDead;
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
