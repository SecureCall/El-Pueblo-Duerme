
import { GameContext, GameStateChange, IRole, NightAction, RoleData, PlayerRoleEnum } from "@/types";
import { createRoleInstance } from "./role-factory";

export class Lobo implements IRole {
  readonly name = PlayerRoleEnum.werewolf;
  readonly description = "Cada noche, te despiertas con tu manada para elegir a una víctima. Tu objetivo es eliminar a los aldeanos hasta que vuestro número sea igual o superior.";
  readonly team = 'Lobos';
  readonly alliance = 'Lobos';

  performNightAction(context: GameContext, action: NightAction): GameStateChange | null {
    if (action.actionType !== 'werewolf_kill') {
      return null;
    }
    // The main logic for werewolf kills is handled in `processNight` to achieve consensus.
    // This action simply registers the vote.
    return {
      playerUpdates: [{ userId: context.player.userId, usedNightAbility: true }]
    };
  }

  onDeath(): GameStateChange | null {
    return null;
  }

  checkWinCondition(context: GameContext): boolean {
    const alivePlayers = context.game.players.filter(p => p.isAlive);
    const aliveWolves = alivePlayers.filter(p => p.role && createRoleInstance(p.role).alliance === 'Lobos');
    const aliveNonWolves = alivePlayers.filter(p => p.role && createRoleInstance(p.role).alliance !== 'Lobos');
    return aliveWolves.length > 0 && aliveWolves.length >= aliveNonWolves.length;
  }
  
  getWinMessage(player: import("@/types").Player): string {
    return "Los lobos han ganado.";
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
