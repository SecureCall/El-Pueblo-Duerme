

import { GameContext, GameStateChange, IRole, NightAction, Player, RoleData, Team } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Hechicera implements IRole {
  readonly name = PlayerRoleEnum.enum.hechicera;
  readonly description = "Posees dos pociones de un solo uso: una de veneno para eliminar a un jugador durante la noche, y una de vida para salvar al objetivo de los lobos. No puedes salvarte a ti misma.";
  readonly team: Team = 'Aldeanos';
  readonly alliance: Team = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    const { player, game } = context;
    const { actionType, targetId } = action;

    if (actionType === 'hechicera_poison' && !player.potions?.poison) {
      return {
        playerUpdates: [{ userId: player.userId, potions: { ...player.potions, poison: game.currentRound } }],
        pendingDeaths: [{ playerId: targetId as string, cause: 'special' }]
      };
    }

    if (actionType === 'hechicera_save' && !player.potions?.save) {
      // La lógica de salvación se maneja centralmente en processNight, aquí solo marcamos la poción como usada.
      return {
        playerUpdates: [{ userId: player.userId, potions: { ...player.potions, save: game.currentRound } }],
      };
    }

    return null;
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
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
