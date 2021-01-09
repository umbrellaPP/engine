declare module 'HAL' {
    export enum AudioType {
        AUDIO_DOM,
        AUDIO_WEB,
    }
    
    export interface AudioLoadOptions {
        audioLoadMode?: AudioType;
    }

    export class IAudioPlayer {
        private constructor (nativeAudio: any);
        static load (url: string,  opts?: AudioLoadOptions): Promise<IAudioPlayer>;
        private static _loadNative(url: string, opts?: AudioLoadOptions): Promise<any>;

        get loop (): boolean;
        set loop (val: boolean);
        get volume (): number;
        set volume (val: number);
        get currentTime (): number;
        play (): Promise<void>;
        pause (): Promise<void>;
        stop (): Promise<void>;
        seek (time: number): Promise<void>;

        onStop (cb);
        offStop (cb?);
        onPause (cb);
        offPause (cb?);
        onEnded (cb);
        offEnded (cb?);
    }
}
