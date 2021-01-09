
import { AudioEvent, AudioState, AudioType } from "../type";
import { EventTarget } from '../../../cocos/core/event/event-target';
import { clamp } from "cocos/core";
import { legacyCC } from "cocos/core/global-exports";
import { OneShotAudio } from "pal:audio";

export class AudioPlayerWeb {
    private static _context: AudioContext = new (window.AudioContext || window.webkitAudioContext || window.mozAudioContext)();
    private _audioBuffer: AudioBuffer;
    private _sourceNode: AudioBufferSourceNode;
    private _gainNode: GainNode;
    private _currentTimer = 0;
    private _volume = 1;
    private _startTime = 0;
    private _offset = 0;
    private _eventTarget: EventTarget = new EventTarget();
    private _state: AudioState = AudioState.INIT;

    private _onGesture: () => void;

    constructor (audioBuffer: AudioBuffer) {
        const context = AudioPlayerWeb._context;
        this._audioBuffer = audioBuffer;
        this._sourceNode = context.createBufferSource();
        this._sourceNode.buffer = audioBuffer;
        this._gainNode = context.createGain();
        this._sourceNode.connect(this._gainNode);
        this._gainNode.connect(context.destination);

        // event
        // TODO: should not call engine API in pal
        this._onGesture = () => this._eventTarget.emit(AudioEvent.USER_GESTURE);
        legacyCC.game.canvas.addEventListener('touchend', this._onGesture);
        legacyCC.game.canvas.addEventListener('mouseup', this._onGesture);
    }
    destroy() {
        if (this._audioBuffer) {
            // @ts-ignore
            this._audioBuffer = undefined;
        }
        if (this._onGesture) {
            legacyCC.game.canvas.removeEventListener('touchend', this._onGesture);
            legacyCC.game.canvas.removeEventListener('mouseup', this._onGesture);
            // @ts-ignore
            this._onGesture = undefined;
        }
    }
    static async load (url: string): Promise<AudioPlayerWeb> {
        let audioBuffer = await AudioPlayerWeb.loadNative(url);
        return new AudioPlayerWeb(audioBuffer);
    }
    static async loadNative(url: string): Promise<AudioBuffer> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const errInfo = `load audio failed: ${url}, status: `;
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 0) {
                    AudioPlayerWeb._context.decodeAudioData(xhr.response).then(buffer => {
                        resolve(buffer);
                    });
                }
                else {
                    reject(new Error(`${errInfo}${xhr.status}(no response)`)); 
                }
            };
            xhr.onerror = () => { reject(new Error(`${errInfo}${xhr.status}(error)`)); };
            xhr.ontimeout = () => { reject(new Error(`${errInfo}${xhr.status}(time out)`)); };
            xhr.onabort = () => { reject(new Error(`${errInfo}${xhr.status}(abort)`)); };

            xhr.send(null);
        });
    }
    
    get type(): AudioType {
        return AudioType.WEB_AUDIO;
    }
    get state(): AudioState {
        return this._state;
    }
    get loop(): boolean {
        return this._sourceNode.loop;
    }
    set loop(val: boolean) {
        this._sourceNode.loop = val;
    }
    get volume(): number {
        return this._volume;
    }
    set volume(val: number) {
        this._volume = val;
        if (this._gainNode.gain.setTargetAtTime) {
            try {
                this._gainNode.gain.setTargetAtTime(val, AudioPlayerWeb._context.currentTime, 0);
            } catch (e) {
                // Some unknown browsers may crash if timeConstant is 0
                this._gainNode.gain.setTargetAtTime(val, AudioPlayerWeb._context.currentTime, 0.01);
            }
        } else {
            this._gainNode.gain.value = val;
        }
    }
    get duration(): number {
        return this._audioBuffer.duration;
    }
    get currentTime(): number {
        if (this._state !== AudioState.PLAYING) { return this._offset; }
        return AudioPlayerWeb._context.currentTime - this._startTime + this._offset;
    }
    seek(time: number): Promise<void> {
        this._offset = clamp(time, 0, this._audioBuffer.duration);
        // TODO
        // this._doStop(); this._doPlay();
        return Promise.resolve();
    }

    private async _runContext (): Promise<void> {
        return new Promise(resolve => {
            const context = AudioPlayerWeb._context;
            if (!context.resume) {
                return resolve();
            }
            if (context.state === 'running') {
                return resolve();
            }
            context.resume();
            // promise rejection cannot be caught, need to check running state again
            // @ts-ignore
            if (context.state !== 'running') {
                this._eventTarget.once(AudioEvent.USER_GESTURE, () => {
                    context.resume().then(resolve);
                });
            }
        });
    }

    playOneShot(volume: number = 1): OneShotAudio {
        let onPlayCb: () => void;
        let onEndedCb: () => void;
        const context = AudioPlayerWeb._context;
        let sourceNode: AudioBufferSourceNode;
        setTimeout(async () => {
            await this._runContext();
            const gainNode = context.createGain();
            gainNode.connect(context.destination);
            gainNode.gain.value = volume;
            sourceNode = context.createBufferSource();
            sourceNode.buffer = this._audioBuffer;
            sourceNode.loop = false;
            sourceNode.connect(gainNode);
            sourceNode.start();
            onPlayCb && onPlayCb();
            onEndedCb && setTimeout(onEndedCb, this._audioBuffer.duration * 1000);
        }, 0);
        let oneShotAudio: OneShotAudio = {
            stop () {
                sourceNode.stop();
            },
            onPlay(cb) {
                onPlayCb = cb;
                return this;
            },
            onEnded(cb) {
                onEndedCb = cb;
                return this;
            },
        }
        return oneShotAudio;
    }
    async play(): Promise<void> {
        const context = AudioPlayerWeb._context;
        await this._runContext();
        if (this._state === AudioState.PLAYING) {
            /* sometimes there is no way to update the playing state
            especially when player unplug earphones and the audio automatically stops
            so we need to force updating the playing state by pausing audio */
            await stop();
        }

        // AudioPlayerWeb._manager.discardOnePlayingIfNeeded(); // TODO
        this._state = AudioState.PLAYING;
        this._startTime = context.currentTime;
        this._sourceNode.start(0, this._offset);
        // AudioPlayerWeb._manager.addPlaying(this);  // TODO
        /* still not supported by all platforms *
        this._sourceNode.onended = this._onEnded;
        /* doing it manually for now */
        let checkEnded = () => {
            if (this.loop) {
                this._currentTimer = window.setInterval(checkEnded, this._audioBuffer.duration * 1000);
            }
            else {  // do ended
                this._eventTarget.emit(AudioEvent.ENDED);
                clearInterval(this._currentTimer);
                this._offset = 0;
                this._startTime = context.currentTime;
                this._state = AudioState.INIT;
                // AudioPlayerWeb._manager.removePlaying(this);  // TODO
            }
        };
        clearInterval(this._currentTimer);
        this._currentTimer = window.setInterval(checkEnded, (this._audioBuffer.duration - this._offset) * 1000);
    }
    pause(): Promise<void> {
        if (this._state !== AudioState.PLAYING) { return Promise.resolve(); }
        this._offset += AudioPlayerWeb._context.currentTime - this._startTime;
        this._state = AudioState.PAUSED;
        clearInterval(this._currentTimer);
        this._sourceNode.stop();
        return Promise.resolve(); 
    }
    stop(): Promise<void> {
        if (this._state !== AudioState.PLAYING) { return Promise.resolve(); }
        this._offset = 0;
        this._state = AudioState.STOPPED;
        clearInterval(this._currentTimer);
        this._sourceNode.stop();
        return Promise.resolve(); 
    }

    onInterruptionBegin(cb: any) { this._eventTarget.on(AudioEvent.INTERRUPTION_BEGIN, cb); }
    offInterruptionBegin(cb?: any) { this._eventTarget.off(AudioEvent.INTERRUPTION_BEGIN, cb); }
    onInterruptionEnd(cb: any) { this._eventTarget.on(AudioEvent.INTERRUPTION_END, cb); }
    offInterruptionEnd(cb?: any) { this._eventTarget.off(AudioEvent.INTERRUPTION_END, cb); }
    onEnded(cb: any) { this._eventTarget.on(AudioEvent.ENDED, cb); }
    offEnded(cb?: any) { this._eventTarget.off(AudioEvent.ENDED, cb); }
}