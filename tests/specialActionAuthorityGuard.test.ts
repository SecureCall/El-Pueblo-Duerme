import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cazadorRoute = readFileSync(resolve(process.cwd(), 'app/api/cazador-shot/route.ts'), 'utf8');
const chivoRoute = readFileSync(resolve(process.cwd(), 'app/api/chivo-choice/route.ts'), 'utf8');
const juezRoute = readFileSync(resolve(process.cwd(), 'app/api/juez-second-vote/route.ts'), 'utf8');
const specialActions = readFileSync(resolve(process.cwd(), 'lib/game/specialActions.ts'), 'utf8');

describe('authoritative special-action guards', () => {
  it('keeps Cazador authority on the server endpoint', () => {
    expect(cazadorRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(cazadorRoute).toContain("hunterRole !== 'Cazador'");
    expect(cazadorRoute).toContain('db.runTransaction');
  });

  it('keeps Chivo authority on the server endpoint', () => {
    expect(chivoRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(chivoRoute).toContain("role !== 'Chivo Expiatorio'");
    expect(chivoRoute).toContain('db.runTransaction');
  });

  it('keeps Juez authority on the server endpoint', () => {
    expect(juezRoute).toContain('verifyAuthToken');
    expect(juezRoute).toContain("role !== 'Juez'");
    expect(juezRoute).toContain("game.juezUsed === true");
    expect(juezRoute).toContain('db.runTransaction');
    expect(juezRoute).toContain('dayStartedAt: now');
    expect(juezRoute).toContain('phaseEndsAt: now + SECOND_VOTE_MS');
    expect(juezRoute).toContain('now >= phaseEndsAt');
    expect(juezRoute).toContain("PHASE_EXPIRED");
  });

  it('binds AI wolf agreement to the authenticated human chat message', () => {
    const wolfRoute = readFileSync(resolve(process.cwd(), 'app/api/wolf-agree/route.ts'), 'utf8');
    const gameplay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');
    expect(wolfRoute).toContain("const messageId = typeof body?.messageId === 'string'");
    expect(wolfRoute).toContain("const chatRef = gameRef.collection('wolfChat').doc(messageId)");
    expect(wolfRoute).toContain("chat.senderId !== uid");
    expect(gameplay).toContain("body: JSON.stringify({ gameId, messageId: latestId })");
    expect(gameplay).not.toContain("humanMessage: latestMsg.text");
  });

  it('keeps wolf chat private to living wolves or an active spy', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(rules).toContain("p.uid == request.auth.uid && p.isAlive == true");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) in ['Lobo', 'Lobo Blanco', 'Cría de Lobo']");
    expect(rules).toContain("privateRole(gameId, request.auth.uid) == 'Espía' && get(/databases/$(database)/documents/games/$(gameId)).data.espiaUsed == true");
  });

  it('keeps Ghost and AI wolf chat persistence on the server', () => {
    const ghostRoute = readFileSync(resolve(process.cwd(), 'app/api/fantasma-message/route.ts'), 'utf8');
    const wolfRoute = readFileSync(resolve(process.cwd(), 'app/api/wolf-agree/route.ts'), 'utf8');
    const gameplay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');
    expect(ghostRoute).toContain('pass = body?.pass === true');
    expect(ghostRoute).toContain('tx.update(gameRef');
    expect(wolfRoute).toContain("source: 'server-wolf-ai'");
    expect(gameplay).not.toContain("addDoc(collection(db, 'games', gameId, 'wolfChat')");
  });

  it('provides a client helper instead of direct Juez state mutation', () => {
    expect(specialActions).toContain("'/api/juez-second-vote'");
    expect(specialActions).toContain('requestJuezSecondVote');
  });
});
