import type { AudioMix } from '../audio/audio-mixer';
import { audioDirector } from '../audio/audio-director';
import type { VoiceParticipant } from './voice-contract';
import { VoiceController } from './voice-controller';

/**
 * Keeps real remote voice tracks synchronized with the cinematic audio mix.
 * The bridge changes gain only; it never disconnects or mutes the voice room.
 */
export class VoiceAudioBridge {
  private participants: VoiceParticipant[] = [];
  private unsubParticipants: (() => void) | null = null;
  private unsubMix: (() => void) | null = null;

  constructor(private readonly voiceController: VoiceController) {}

  install(): () => void {
    this.uninstall();
    this.unsubParticipants = this.voiceController.onParticipantsChange?.(participants => {
      this.participants = participants;
      void this.applyMix(audioDirector.getMix());
    }) ?? null;
    this.unsubMix = audioDirector.onMixChange(mix => { void this.applyMix(mix); });
    void this.applyMix(audioDirector.getMix());

    return () => this.uninstall();
  }

  uninstall() {
    this.unsubParticipants?.();
    this.unsubMix?.();
    this.unsubParticipants = null;
    this.unsubMix = null;
  }

  private async applyMix(mix: AudioMix) {
    const voiceGain = Math.max(0, Math.min(1, mix.voice));
    await Promise.all(this.participants.map(participant =>
      this.voiceController.setParticipantVolume(participant.playerId, voiceGain).catch(() => undefined)
    ));
  }
}
