import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nightPhase = readFileSync(resolve(process.cwd(), 'components/game/play/NightPhase.tsx'), 'utf8');
const privateState = readFileSync(resolve(process.cwd(), 'app/api/game-private-state/route.ts'), 'utf8');
const voiceChat = readFileSync(resolve(process.cwd(), 'components/game/play/VoiceChat.tsx'), 'utf8');

describe('private role state in night phase', () => {
  it('does not read roles from the public game document', () => {
    expect(nightPhase).not.toContain('game.roles?.');
    expect(nightPhase).toContain('getPrivateGameState(gameId)');
    expect(nightPhase).toContain('const effectiveRole = privateRole || myRole');
  });

  it('only returns sibling identities to players with the matching private role', () => {
    expect(privateState).toContain("myRole === 'Gemelas' || myRole === 'Hermanos'");
    expect(privateState).toContain('knownAllies');
  });

  it('keeps voice-chat hooks unconditional across night renders', () => {
    expect(voiceChat).toContain('const shouldRender =');
    expect(voiceChat).toContain('enabled: shouldRender');
    expect(voiceChat).toContain('if (!shouldRender) return null;');
  });
});
