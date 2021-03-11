/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2020 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const { loadInnerAudioContext } = require('./download-audio');

const AudioEvent = {
    STARTED: 'started',
    PAUSED: 'paused',
    STOPPED: 'stopped',
};

const AudioPlayer = cc.internal.AudioPlayer;
if (AudioPlayer) {
    const { PlayingState, AudioType } = cc.AudioClip;
    const AudioManager = cc.internal.AudioManager;
    AudioManager.maxAudioChannel = 10;

    class AudioManagerMiniGame extends AudioManager {
        discardOnePlayingIfNeeded() {
            if (this._playingAudios.length < AudioManager.maxAudioChannel) {
                return;
            }

            // a played audio has a higher priority than a played shot
            let audioToDiscard;
            let oldestOneShotIndex = this._playingAudios.findIndex(audio => !(audio instanceof AudioPlayerRuntime));
            if (oldestOneShotIndex > -1) {
                audioToDiscard = this._playingAudios[oldestOneShotIndex];
                this._playingAudios.splice(oldestOneShotIndex, 1);
            }
            else {
                audioToDiscard = this._playingAudios.shift();
            }
            if (audioToDiscard) {
                audioToDiscard.stop();
            }
        }
    }

    cc.AudioClip.prototype._getPlayer = function (clip) {
        this._loadMode = AudioType.JSB_AUDIO;
        return AudioPlayerRuntime;
    };

    class AudioPlayerRuntime extends AudioPlayer {
        static _manager = new AudioManagerMiniGame();
        _startTime = 0;
        _offset = 0;
        _volume = 1;
        _loop = false;

        // NOTE: should not call the play() method when the another play operation is executing
        _playCalling = false;

        _onPlay = null;
        _onPaused = null;
        _onStopped = null;
        _onEnded = null;
        _onError = null;

        constructor (info) {
            super(info);
            this._nativeAudio = info.nativeAudio;

            this._onPlay = () => {
                if (this._state === PlayingState.PLAYING) { return; }
                this._state = PlayingState.PLAYING;
                this._startTime = performance.now();
                this._clip.emit(AudioEvent.STARTED);
            };
            this._nativeAudio.onPlay(this._onPlay);
            this._onPaused = () => {
                if (this._state === PlayingState.STOPPED) { return; }
                this._state = PlayingState.STOPPED;
                this._offset += performance.now() - this._startTime;
                this._clip.emit(AudioEvent.PAUSED);
            };
            this._nativeAudio.onPause(this._onPaused);
            this._onStopped = () => {
                if (this._state === PlayingState.STOPPED) { return; }
                this._state = PlayingState.STOPPED;
                this._offset = 0;
                this._clip.emit(AudioEvent.STOPPED);
            };
            this._nativeAudio.onStop(this._onStopped);
            this._onEnded = () => {
                if (this._state === PlayingState.STOPPED) { return; }
                this._state = PlayingState.STOPPED;
                this._offset = 0;
                this._clip.emit('ended');
                AudioPlayerRuntime._manager.removePlaying(this);
            };
            this._nativeAudio.onEnded(this._onEnded);
            this._onError = (res) => { return console.error(res.errMsg);}
            this._nativeAudio.onError(this._onError);
        }

        _ensureStop () {
            return new Promise((resolve) => {
                if (this._state === PlayingState.PLAYING) {
                    /* sometimes there is no way to update the playing state
                    especially when player unplug earphones and the audio automatically stops
                    so we need to force updating the playing state by pausing audio */
                    this.pause().then(() => {
                        // restart if already playing
                        this.setCurrentTime(0);
                        resolve();
                    });
                    return;
                }
                return resolve();
            });
        }

        play () {
            return new Promise((resolve) => {
                if (!this._nativeAudio || this._playCalling) { return; }
                if (this._blocking) { this._interrupted = true; return; }
                this._playCalling = true;
                // AudioPlayerRuntime._manager.discardOnePlayingIfNeeded();
                this._ensureStop().then(() => {
                    this._clip.once(AudioEvent.STARTED, () => {
                        AudioPlayerRuntime._manager.addPlaying(this);
                        console.error('onPlay');
                        this._playCalling = false;
                        resolve();
                    });
                    console.warn('play');
                    this._nativeAudio.play();
                });
            });
        }

        pause () {
            return new Promise((resolve)  => {
                if (!this._nativeAudio || this._state !== PlayingState.PLAYING) { return resolve(); }
                this._clip.once(AudioEvent.PAUSED, () => {
                    AudioPlayerRuntime._manager.removePlaying(this._clip);
                    resolve();
                });
                this._nativeAudio.pause();
            });
        }

        stop () {
            return new Promise((resolve) => {
                if (!this._nativeAudio) { return resolve(); }
                this._clip.once(AudioEvent.STOPPED, () => {
                    AudioPlayerRuntime._manager.removePlaying(this._clip);
                    resolve();
                });
                this._nativeAudio.stop();
            });
        }

        playOneShot (volume) {
            loadInnerAudioContext(this._nativeAudio.src).then(innerAudioContext => {
                AudioPlayerRuntime._manager.discardOnePlayingIfNeeded();
                innerAudioContext.volume = volume;
                innerAudioContext.play();
                AudioPlayerRuntime._manager.addPlaying(innerAudioContext);
                innerAudioContext.onEnded(() => {
                    AudioPlayerRuntime._manager.removePlaying(innerAudioContext);
                });
            });
        }

        getCurrentTime () {
            if (this._state !== PlayingState.PLAYING) { return this._offset / 1000; }
            let current = (performance.now() - this._startTime + this._offset) / 1000;
            if (current > this._duration) {
                if (!this._loop) return 0;
                current -= this._duration; this._startTime += this._duration * 1000;
            }
            return current;
        }

        setCurrentTime (val) {
            if (!this._nativeAudio) { return; }
            this._offset = cc.math.clamp(val, 0, this._duration) * 1000;
            this._startTime = performance.now();
            this._nativeAudio.seek(val);
        }

        getVolume () {
            return this._volume;
        }

        setVolume (val, immediate) {
            this._volume = val;
            if (this._nativeAudio) { this._nativeAudio.volume = val; }
        }

        getLoop () {
            return this._loop;
        }

        setLoop (val) {
            this._loop = val;
            if (this._nativeAudio) { this._nativeAudio.loop = val; }
        }

        destroy () {
            if (!this._nativeAudio) {
                return;
            }
            if (this._onPlay) {
                this._nativeAudio.offPlay(this._onPlay);
                delete this._onPlay;
            }
            if (this._onPaused) {
                this._nativeAudio.offPaused(this._onPaused);
                delete this._onPaused;
            }
            if (this._onStopped) {
                this._nativeAudio.offStop(this._onStopped);
                delete this._onStopped;
            }
            if (this._onEnded) {
                this._nativeAudio.offEnded(this._onEnded);
                delete this._onEnded;
            }
            if (this._onError) {
                this._nativeAudio.offError(this._onError);
                delete this._onError;
            }
            this._nativeAudio.destroy();
            super.destroy();
        }
    }
}
