import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const xpClient = readFileSync(resolve(process.cwd(), 'lib/firebase/xp.ts'), 'utf8');
const xpRoute = readFileSync(resolve(process.cwd(), 'app/api/award-xp/route.ts'), 'utf8');
const endGame = readFileSync(resolve(process.cwd(), 'components/game/play/EndGame.tsx'), 'utf8');
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Progression authority', () => {
  it('does not let the browser write XP or progression fields directly', () => {
    expect(xpClient).not.toContain("runTransaction(db");
    expect(xpClient).not.toContain("setDoc(");
    expect(xpClient).not.toContain("updateDoc(");
    expect(xpClient).toContain("fetch('/api/award-xp'");
  });

  it('derives the award from the authenticated player and authoritative ended game', () => {
    expect(xpRoute).toContain('const uid = await verifyAuthToken(req);');
    expect(xpRoute).toContain("game.phase !== 'ended'");
    expect(xpRoute).toContain("gameRef = db.collection('games').doc(gameId)");
    expect(xpRoute).toContain("roleRef = gameRef.collection('playerRoles').doc(uid)");
    expect(xpRoute).toContain("tx.create(awardRef");
    expect(xpRoute).toContain("xp: newXp");
    expect(xpRoute).not.toContain("body.isWin");
    expect(xpRoute).not.toContain("body.hasSpecialRole");
    expect(xpRoute).not.toContain("body.consecutiveWins");
  });

  it('binds the client request to the game id without trusting result fields', () => {
    expect(endGame).toContain("body: JSON.stringify({ gameId })");
    expect(endGame).not.toContain("body: JSON.stringify({ isWin:");
    expect(endGame).not.toContain("recordGameResult(");
  });

  it('blocks client progression mutations in Firestore rules', () => {
    expect(rules).toContain("onlyUpdating(['displayName','photoURL'])");
    expect(rules).toContain("allow create, update, delete: if false;");
  });
});
