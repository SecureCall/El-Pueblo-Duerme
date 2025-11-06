
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Banshee implements IRole {
  readonly name = PlayerRoleEnum.banshee;
  readonly description = "Cada noche, predices la muerte de un jugador. Si ese jugador muere esa misma noche (por cualquier causa), ganas un punto. Ganas la partida si acumulas 2 puntos.";
  readonly team = 'Neutral';
  readonly alliance = 'Neutral';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
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
    
    const screams = Object.entries(player.bansheeScreams);
    if (screams.length < 2) {
      return false;
    }
    
    let correctPredictions = 0;

    for (const [roundStr, targetId] of screams) {
        const round = parseInt(roundStr, 10);
        // Find deaths that happened in the same night or the following day phase
        const deathEvent = game.events.find(e => 
            (e.round === round && (e.type === 'night_result' || e.type === 'werewolf_kill' || e.type === 'vampire_kill' || e.type === 'special')) ||
            (e.round === round && e.type === 'vote_result')
        );

        if (deathEvent?.data?.killedPlayerIds?.includes(targetId) || deathEvent?.data?.lynchedPlayerId === targetId) {
            correctPredictions++;
        }
    }

    return correctPredictions >= 2;
  }

  getWinMessage(player: Player): string {
    return `¡La Banshee ha ganado! Sus gritos han sentenciado a muerte y ha cumplido su objetivo.`;
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
