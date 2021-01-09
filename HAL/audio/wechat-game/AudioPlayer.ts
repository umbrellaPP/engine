import { EventTarget } from '../../../cocos/core/event/event-target';
import { AudioEvent } from '../type';

export class AudioPlayer {
    private _nativeAudio: any;
    private _eventTarget: EventTarget;

    constructor (nativeAudio: any) {
        this._nativeAudio = nativeAudio; 
        this._eventTarget = new EventTarget();   
    }

    static async load (url: string): Promise<AudioPlayer> {
        let innerAudioContext = await AudioPlayer.loadNative(url);
        let player = new AudioPlayer(innerAudioContext);
        // event register
        let eventTarget = player._eventTarget;
        innerAudioContext.onPlay(() => { eventTarget.emit(AudioEvent.PLAYED); });
        innerAudioContext.onPause(() => { eventTarget.emit(AudioEvent.PAUSED); });
        innerAudioContext.onStop(() => { eventTarget.emit(AudioEvent.STOPPED); });
        innerAudioContext.onSeeked(() => { eventTarget.emit(AudioEvent.SEEKED); });
        innerAudioContext.onEnded(() => { eventTarget.emit(AudioEvent.ENDED); });
        return player;
    }

    static loadNative (url: string): Promise<any> {
        return new Promise(resolve => {
            // @ts-ignore
            let innerAudioContext = wx.createInnerAudioContext();
            // TODO: handle timeout
            innerAudioContext.onCanplay(() => {
                resolve(innerAudioContext);
            });
            innerAudioContext.src = url;
        });
    }

    play (): Promise<void> {
        return new Promise(resolve => {
            this._eventTarget.once(AudioEvent.PLAYED, resolve);
            this._nativeAudio.play();
        });
    }

    pause (): Promise<void> {
        return new Promise(resolve => {
            this._eventTarget.once(AudioEvent.PAUSED, resolve);
            this._nativeAudio.pause();
        });
    }

    stop (): Promise<void> {
        return new Promise(resolve => {
            this._eventTarget.once(AudioEvent.STOPPED, resolve);
            this._nativeAudio.stop();
        });
    }

    onStop (cb) { this._eventTarget.on(AudioEvent.STOPPED, cb); }
    offStop (cb?) { this._eventTarget.off(AudioEvent.STOPPED, cb); }
    onPause (cb) { this._eventTarget.on(AudioEvent.PAUSED, cb); }
    offPause (cb?) { this._eventTarget.off(AudioEvent.PAUSED, cb); }
    onEnded (cb) { this._eventTarget.on(AudioEvent.ENDED, cb); }
    offEnded (cb?) { this._eventTarget.off(AudioEvent.ENDED, cb); }
}