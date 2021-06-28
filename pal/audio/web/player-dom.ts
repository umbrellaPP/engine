import { system } from 'pal/system';
import { OneShotAudio } from 'pal/audio';
import { AudioEvent, AudioState, AudioType } from '../type';
import { EventTarget } from '../../../cocos/core/event/event-target';
import { legacyCC } from '../../../cocos/core/global-exports';
import { clamp, clamp01 } from '../../../cocos/core';
import { BrowserType, OS } from '../../system/enum-type';

export class AudioPlayerDOM {
    private _domAudio?: HTMLAudioElement;
    private _eventTarget: EventTarget = new EventTarget();
    private _state: AudioState = AudioState.INIT;
    private _onGesture?: () => void;
    private _onHide?: () => void;
    private _onShow?: () => void;
    private _onEnded?: () => void;

    constructor (nativeAudio: HTMLAudioElement) {
        this._domAudio = nativeAudio;

        // event
        // TODO: should not call engine API in pal
        this._onGesture = () => this._eventTarget.emit(AudioEvent.USER_GESTURE);
        legacyCC.game.canvas.addEventListener('touchend', this._onGesture);
        legacyCC.game.canvas.addEventListener('mouseup', this._onGesture);
        this._onHide = () => {
            if (this._state === AudioState.PLAYING) {
                this.pause().then(() => {
                    this._state = AudioState.INTERRUPTED;
                    this._eventTarget.emit(AudioEvent.INTERRUPTION_BEGIN);
                }).catch((e) => {});
            }
        };
        legacyCC.game.on(legacyCC.Game.EVENT_HIDE, this._onHide);
        this._onShow = () => {
            if (this._state === AudioState.INTERRUPTED) {
                this.play().then(() => {
                    this._eventTarget.emit(AudioEvent.INTERRUPTION_END);
                }).catch((e) => {});
            }
        };
        legacyCC.game.on(legacyCC.Game.EVENT_SHOW, this._onShow);
        this._onEnded = () => {
            this.seek(0).catch((e) => {});
            this._state = AudioState.INIT;
            this._eventTarget.emit(AudioEvent.ENDED);
        };
        this._domAudio.addEventListener('ended', this._onEnded);
    }
    destroy () {
        if (this._onGesture) {
            legacyCC.game.canvas.removeEventListener('touchend', this._onGesture);
            legacyCC.game.canvas.removeEventListener('mouseup', this._onGesture);
            this._onGesture = undefined;
        }
        if (this._onShow) {
            legacyCC.game.off(legacyCC.Game.EVENT_SHOW, this._onShow);
            this._onShow = undefined;
        }
        if (this._onHide) {
            legacyCC.game.off(legacyCC.Game.EVENT_HIDE, this._onHide);
            this._onHide = undefined;
        }
        if (this._onEnded) {
            this._domAudio!.removeEventListener('ended', this._onEnded);
            this._onEnded = undefined;
        }
        this._domAudio = undefined;
    }
    static load (url: string): Promise<AudioPlayerDOM> {
        return new Promise((resolve) => {
            AudioPlayerDOM.loadNative(url).then((domAudio) => {
                resolve(new AudioPlayerDOM(domAudio));
            }).catch((e) => {});
        });
    }
    static loadNative (url: string): Promise<HTMLAudioElement> {
        return new Promise((resolve, reject) => {
            const domAudio = document.createElement('audio');
            const sys = legacyCC.sys;
            let loadedEvent = 'canplaythrough';
            if (system.os === OS.IOS) {
                // iOS no event that used to parse completed callback
                // this time is not complete, can not play
                loadedEvent = 'loadedmetadata';
            } else if (system.browserType === BrowserType.FIREFOX) {
                loadedEvent = 'canplay';
            }

            const timer = setTimeout(() => {
                if (domAudio.readyState === 0) {
                    failure();
                } else {
                    success();
                }
            }, 8000);
            const clearEvent = () => {
                clearTimeout(timer);
                domAudio.removeEventListener(loadedEvent, success, false);
                domAudio.removeEventListener('error', failure, false);
            };
            const success = () => {
                clearEvent();
                resolve(domAudio);
            };
            const failure = () => {
                clearEvent();
                const message = `load audio failure - ${url}`;
                reject(message);
            };
            domAudio.addEventListener(loadedEvent, success, false);
            domAudio.addEventListener('error', failure, false);
            domAudio.src = url;
        });
    }

    get type (): AudioType {
        return AudioType.DOM_AUDIO;
    }
    get state (): AudioState {
        return this._state;
    }
    get loop (): boolean {
        return this._domAudio!.loop;
    }
    set loop (val: boolean) {
        this._domAudio!.loop = val;
    }
    get volume (): number {
        return this._domAudio!.volume;
    }
    set volume (val: number) {
        val = clamp01(val);
        this._domAudio!.volume = val;
    }
    get duration (): number {
        return this._domAudio!.duration;
    }
    get currentTime (): number {
        return this._domAudio!.currentTime;
    }
    seek (time: number): Promise<void> {
        time = clamp(time, 0, this.duration);
        this._domAudio!.currentTime = time;
        return Promise.resolve();
    }

    private _ensurePlaying (domAudio: HTMLAudioElement): Promise<void> {
        return new Promise((resolve) => {
            const promise = domAudio.play();
            if (promise === undefined) {  // Chrome50/Firefox53 below
                return resolve();
            }
            promise.then(resolve).catch(() => {
                this._eventTarget.once(AudioEvent.USER_GESTURE, () => {
                    domAudio.play().catch((e) => {});
                    resolve();
                });
            });
            return null;
        });
    }
    playOneShot (volume = 1): OneShotAudio {
        let onPlayCb: () => void;
        let onEndedCb: () => void;
        let domAudio: HTMLAudioElement;
        AudioPlayerDOM.loadNative(this._domAudio!.src).then((res) => {
            domAudio = res;
            domAudio.volume = volume;
            onEndedCb && domAudio.addEventListener('ended', onEndedCb);
            this._ensurePlaying(domAudio).then(() => {
                onPlayCb &&  onPlayCb();
            }).catch((e) => {});
        }).catch((e) => {});
        const oneShotAudio: OneShotAudio = {
            stop () {
                domAudio.pause();
            },
            onPlay (cb) {
                onPlayCb = cb;
                return this;
            },
            onEnded (cb) {
                onEndedCb = cb;
                return this;
            },
        };
        return oneShotAudio;
    }

    private _ensureStop (): Promise<void> {
        return new Promise((resolve) => {
            /* sometimes there is no way to update the playing state
            especially when player unplug earphones and the audio automatically stops
            so we need to force updating the playing state by pausing audio */
            if (this._state === AudioState.PLAYING) {
                this.stop().then(resolve).catch((e) => {});
            } else {
                resolve();
            }
        });
    }
    play (): Promise<void> {
        return new Promise((resolve) => {
            this._ensureStop().then(() => {
                this._ensurePlaying(this._domAudio!).then(() => {
                    this._state = AudioState.PLAYING;
                    resolve();
                }).catch((e)  => {});
            }).catch((e) => {});
        });
    }
    pause (): Promise<void> {
        this._domAudio!.pause();
        this._state = AudioState.PAUSED;
        return Promise.resolve();
    }
    stop (): Promise<void> {
        this._domAudio!.pause();
        this._state = AudioState.STOPPED;
        return this.seek(0);
    }

    onInterruptionBegin (cb: () => void) { this._eventTarget.on(AudioEvent.INTERRUPTION_BEGIN, cb); }
    offInterruptionBegin (cb?: () => void) { this._eventTarget.off(AudioEvent.INTERRUPTION_BEGIN, cb); }
    onInterruptionEnd (cb: () => void) { this._eventTarget.on(AudioEvent.INTERRUPTION_END, cb); }
    offInterruptionEnd (cb?: () => void) { this._eventTarget.off(AudioEvent.INTERRUPTION_END, cb); }
    onEnded (cb: () => void) { this._eventTarget.on(AudioEvent.ENDED, cb); }
    offEnded (cb?: () => void) { this._eventTarget.off(AudioEvent.ENDED, cb); }
}
