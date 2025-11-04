
import type { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types";

export class Vidente implements IRole {
  readonly name = PlayerRoleEnum.enum.seer;
  readonly description = "Cada noche, eliges a un jugador para investigar. Se te revelará si es un Hombre Lobo o no.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    // The main logic for the seer's result is handled in `getSeerResult`
    // which is called client-side after the action is submitted.
    // This action simply registers the attempt on the backend.
    return {
       playerUpdates: [{
         userId: context.player.userId,
         usedNightAbility: true,
       }],
       events: [{
        id: `evt_seer_check_${Date.now()}`,
        gameId: context.game.id,
        round: context.game.currentRound,
        type: 'special',
        message: `${context.player.displayName} está usando su poder...`,
        data: { targetId: context.player.userId },
        createdAt: new Date(),
       }]
    };
  }

  onDeath(context: GameContext): GameStateChange | null {
    // When the seer dies, we need to flag it in the game state
    // so the apprentice can take over.
    return {
      game: {
        seerDied: true,
      }
    };
  }

  checkWinCondition(context: GameContext): boolean {
    // Standard villager win condition is handled centrally.
    return false;
  }

  getWinMessage(player: Player): string {
    return "El pueblo ha ganado.";
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
