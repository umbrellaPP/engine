import { AudioLoadOptions, AudioType, IAudioPlayer } from 'HAL';
import { AudioPlayerDOM } from './audio-player-dom';
import { AudioPlayerWeb } from './audio-player-web';

export class AudioPlayer implements IAudioPlayer {
    private _player: IAudioPlayer;

    private constructor (nativeAudio: any) { }
    static async load (url: string,  opts?: AudioLoadOptions): Promise<IAudioPlayer> {
        let nativeAudio = await AudioPlayer.loadNative(url, opts);
        if (opts?.audioLoadMode === AudioType.AUDIO_DOM) {
            return new AudioPlayerDOM(nativeAudio);
        }
        return new AudioPlayerWeb(nativeAudio);
    }
    static async loadNative(url: string, opts?: AudioLoadOptions): Promise<any> {
        if (opts?.audioLoadMode === AudioType.AUDIO_DOM) {
            return await AudioPlayerDOM.loadNative(url);
        }
        return AudioPlayerWeb.loadNative(url);
    }

    static async playNative(nativeAudio: any): Promise<any> {
        if (nativeAudio instanceof HTMLAudioElement) {
            return AudioPlayerDOM.playNative(nativeAudio);
        }
        return AudioPlayerWeb.playNative(nativeAudio);
    }

    get loop(): boolean {  return this._player.loop; }
    set loop(val: boolean) { this._player.loop = val; }
    get volume(): number { return this._player.volume; }
    set volume(val: number) { this._player.volume = val; }
    get currentTime(): number { return this._player.currentTime; }
    
    play(): Promise<void> { return this._player.play(); }
    pause(): Promise<void> { return this._player.pause(); }
    stop(): Promise<void> { return this._player.stop(); }
    seek(time: number): Promise<void> { return this._player.seek(time); }
    onStop(cb: any) { this._player.onStop(cb); }
    offStop(cb?: any) { this._player.offStop(cb); }
    onPause(cb: any) { this._player.onPause(cb); }
    offPause(cb?: any) { this._player.offPause(cb); }
    onEnded(cb: any) { this._player.onEnded(cb); }
    offEnded(cb?: any) { this._player.offEnded(cb); }
}