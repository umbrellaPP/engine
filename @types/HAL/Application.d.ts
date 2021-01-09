declare module 'HAL' {
    export interface Application {
        onHide: (cb: () => void) => void;
    }
}