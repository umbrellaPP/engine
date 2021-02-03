import { resolve } from "path";
import * as rollup from 'rollup';

export function palModuleResolve (engineRoot: string): rollup.Plugin {
    return {
        name: '@cocos/pal-module-resolve',
        // eslint-disable-next-line @typescript-eslint/require-await
        async resolveId (importee) {
            if (importee === 'pal:audio') {
                return resolve(engineRoot, 'pal/audio/web/player.ts');
            }
            return null;
        },        
    };
}