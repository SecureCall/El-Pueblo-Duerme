
import { GameContext, GameStateChange, IRole, NightAction, RoleData, Player } from "@/types";
import { PlayerRoleEnum } from "@/types/zod";

export class Gemela implements IRole {
  readonly name = PlayerRoleEnum.TWIN;
  readonly description = "En la primera noche, tú y tu gemelo/a os reconoceréis. A partir de entonces, podréis hablar en un chat privado. Si uno muere, el otro morirá de pena al instante.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    // La lógica de los gemelos se maneja al inicio del juego, no tienen acción nocturna.
    return null;
  }

  onDeath(context: GameContext): GameStateChange | null {
    const { game, player } = context;
    if (game.twins && game.twins.includes(player.userId)) {
      const otherTwinId = game.twins.find((id: string) => id !== player.userId);
      if (otherTwinId) {
        return {
          pendingDeaths: [{ playerId: otherTwinId, cause: 'special' }]
        };
      }
    }
    return null;
  }

  checkWinCondition(): boolean {
    // Gana con los aldeanos
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
