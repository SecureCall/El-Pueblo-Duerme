import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const cazador = read('app/api/cazador-shot/route.ts');
const chivo = read('app/api/chivo-choice/route.ts');
const juez = read('app/api/juez-second-vote/route.ts');
const alborotadora = read('app/api/alborotadora-fight/route.ts');
const fantasma = read('app/api/fantasma-message/route.ts');

function assertAuthenticated(source: string) {
  expect(source).toContain('verifyAuthToken');
  expect(source).toContain('isAuthorizedServerRequest');
}

describe('special action endpoints authority', () => {
  it('requires server/authenticated access for Cazador, Chivo and Juez', () => {
    for (const source of [cazador, chivo, juez]) assertAuthenticated(source);
  });

  it('verifies the authoritative role from private playerRoles for Cazador, Chivo and Juez', () => {
    expect(cazador).toContain("gameRef.collection('playerRoles').doc(pendingUid)");
    expect(cazador).toContain("roleSnap.data()?.role !== 'Cazador'");
    expect(chivo).toContain("gameRef.collection('playerRoles').doc(pendingUid)");
    expect(chivo).toContain("roleSnap.data()?.role !== 'Chivo Expiatorio'");
    expect(juez).toContain("gameRef.collection('playerRoles').doc(tokenUid)");
    expect(juez).toContain("roleSnap.data()?.role !== 'Juez'");
  });

  it('makes Alborotadora resolution one-shot and server-authoritative', () => {
    assertAuthenticated(alborotadora);
    expect(alborotadora).toContain("game.alborotadoraUsed === true || game.alborotadoraFight != null");
    expect(alborotadora).toContain("roleSnap.data()?.role !== 'Alborotadora'");
    expect(alborotadora).toContain("tx.update(gameRef, { alborotadoraFight: [firstUid, secondUid], alborotadoraUsed: true })");
  });

  it('makes Fantasma messages one-shot, target only living players and write atomically', () => {
    assertAuthenticated(fantasma);
    expect(fantasma).toContain('pending.includes(actorUid) || used.includes(actorUid)');
    expect(fantasma).toContain('actor.isAlive === true');
    expect(fantasma).toContain('target.isAlive !== true');
    expect(fantasma).toContain(`const MAX_MESSAGE_LENGTH = 280`);
    expect(fantasma).toContain('tx.set(chatRef');
    expect(fantasma).toContain('tx.update(gameRef, { fantasmaPending: nextPending, fantasmaUsed: [...used, actorUid] })');
  });
});
