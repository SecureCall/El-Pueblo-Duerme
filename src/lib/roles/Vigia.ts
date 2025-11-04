
import { GameContext, GameStateChange, IRole, NightAction, RoleData, RoleName, Team } from "@/types";

export class Vigia implements IRole {
  readonly name = 'lookout';
  readonly description = "Una vez por partida, en la noche, puedes elegir espiar a un jugador para ver quién lo visita. Si los lobos te eligen como víctima esa noche, morirás antes de ver nada.";
  readonly team = 'Aldeanos';
  readonly alliance = 'Aldeanos';

  onNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'lookout_spy' || !action.targetId) {
      return null;
    }

    // La lógica de quién visita se debe calcular en `processNight` después de recoger todas las acciones
    // Aquí solo marcamos la habilidad como usada
    return {
      playerUpdates: [{ userId: context.player.userId, lookoutUsed: true }],
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(): boolean {
    return false;
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
