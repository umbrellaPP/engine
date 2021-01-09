import { AudioLoadOptions, AudioType, IAudioPlayer } from 'HAL';

export class AudioPlayerDOM implements IAudioPlayer {
    constructor (nativeAudio: any) {
        throw new Error('Method not implemented.');
    }
    static load (url: string,  opts?: AudioLoadOptions): Promise<IAudioPlayer> {
        throw new Error('Method not implemented.');
    }
    static async loadNative(url: string, opts?: AudioLoadOptions): Promise<any> {
        throw new Error('Method not implemented.');
    }
    get loop(): boolean {
        throw new Error('Method not implemented.');
    }
    set loop(val: boolean) {
        throw new Error('Method not implemented.');
    }
    get volume(): number {
        throw new Error('Method not implemented.');
    }
    set volume(val: number) {
        throw new Error('Method not implemented.');
    }
    get currentTime(): number {
        throw new Error('Method not implemented.');
    }
    play(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    pause(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    stop(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    seek(time: number): Promise<void> {
        throw new Error('Method not implemented.');
    }
    onStop(cb: any) {
        throw new Error('Method not implemented.');
    }
    offStop(cb?: any) {
        throw new Error('Method not implemented.');
    }
    onPause(cb: any) {
        throw new Error('Method not implemented.');
    }
    offPause(cb?: any) {
        throw new Error('Method not implemented.');
    }
    onEnded(cb: any) {
        throw new Error('Method not implemented.');
    }
    offEnded(cb?: any) {
        throw new Error('Method not implemented.');
    }

}