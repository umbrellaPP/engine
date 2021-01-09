import { AudioPlayer, OneShotAudio } from "pal:audio";
type ManagedAudio = AudioPlayer | OneShotAudio;

export class AudioManager {
    private _playingAudios: Array<ManagedAudio> = [];

    public addPlaying (audio: ManagedAudio) {
        this._playingAudios.push(audio);
    }

    public removePlaying (audio: ManagedAudio) {
        const index = this._playingAudios.indexOf(audio);
        if (index > -1) {
            this._playingAudios.splice(index, 1);
        }
    }

    public discardOnePlayingIfNeeded () {
        if (this._playingAudios.length < AudioPlayer.maxAudioChannel) {
            return;
        }

        // TODO: support discard policy for audio source
        // a played audio has a higher priority than a played shot
        let audioToDiscard: ManagedAudio | undefined;
        const oldestOneShotIndex = this._playingAudios.findIndex((audio) => !(audio instanceof AudioPlayer));
        if (oldestOneShotIndex > -1) {
            audioToDiscard = this._playingAudios[oldestOneShotIndex];
            this._playingAudios.splice(oldestOneShotIndex, 1);
            audioToDiscard.stop();
        } else {
            audioToDiscard = this._playingAudios.shift();
            audioToDiscard?.stop();
        }
    }
}

export let audioManager = new AudioManager();