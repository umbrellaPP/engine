import { COCOSPLAY, HUAWEI, LINKSURE, OPPO, QTT, VIVO } from 'internal:constants';
import { SystemInfo, IMiniGame } from 'pal/minigame';

import { Orientation } from '../system/enum-type/orientation';
import { cloneObject } from '../utils';

declare let ral: any;

// @ts-expect-error can't init mg when it's declared
const mg: IMiniGame = {};
cloneObject(mg, ral);

// #region SystemInfo
const systemInfo = mg.getSystemInfoSync();
mg.isDevTool = (systemInfo.platform === 'devtools');

// NOTE: size and orientation info is wrong at the init phase, need to define as a getter
Object.defineProperty(mg, 'isLandscape', {
    get () {
        if (VIVO) {
            return systemInfo.screenWidth > systemInfo.screenHeight;
        } else {
            const locSysInfo = mg.getSystemInfoSync();
            return locSysInfo.screenWidth > locSysInfo.screenHeight;
        }
    },
});
// init landscapeOrientation as LANDSCAPE_RIGHT
const landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
// NOTE: onDeviceOrientationChange is not supported on this platform
// ral.onDeviceOrientationChange((res) => {
//     if (res.value === 'landscape') {
//         landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
//     } else if (res.value === 'landscapeReverse') {
//         landscapeOrientation = Orientation.LANDSCAPE_LEFT;
//     }
// });
Object.defineProperty(mg, 'orientation', {
    get () {
        return mg.isLandscape ? landscapeOrientation : Orientation.PORTRAIT;
    },
});

if (VIVO) {
    // TODO: need to be handled in ral lib.
    mg.getSystemInfoSync = function () {
        const sys = ral.getSystemInfoSync() as SystemInfo;
        // on VIVO, windowWidth should be windowHeight when it is landscape
        sys.windowWidth = sys.screenWidth;
        sys.windowHeight = sys.screenHeight;
        return sys;
    };
} else if (LINKSURE) {
    // TODO: update system info when view resized, currently the resize callback is not supported.
    const cachedSystemInfo = ral.getSystemInfoSync() as SystemInfo;
    mg.getSystemInfoSync = function () {
        return cachedSystemInfo;
    };
}
// #endregion SystemInfo

// #region Accelerometer
mg.onAccelerometerChange = function (cb) {
    ral.onAccelerometerChange((res) => {
        let x = res.x;
        let y = res.y;
        if (mg.isLandscape) {
            const orientationFactor = landscapeOrientation === Orientation.LANDSCAPE_RIGHT ? 1 : -1;
            const tmp = x;
            x = -y * orientationFactor;
            y = tmp * orientationFactor;
        }

        const resClone = {
            x,
            y,
            z: res.z,
        };
        cb(resClone);
    });
};
// #endregion Accelerometer

mg.createInnerAudioContext = function (): InnerAudioContext {
    const audioContext: InnerAudioContext = ral.createInnerAudioContext();

    // HACK: onSeeked method doesn't work on runtime
    const originalSeek = audioContext.seek;
    let _onSeekCB: (()=> void) | null = null;
    audioContext.onSeeked = function (cb: ()=> void) {
        _onSeekCB = cb;
    };
    audioContext.seek = function (time: number) {
        originalSeek.call(audioContext, time);
        _onSeekCB?.();
    };

    // HACK: onPause method doesn't work on runtime
    const originalPause = audioContext.pause;
    let _onPauseCB: (()=> void) | null = null;
    audioContext.onPause = function (cb: ()=> void) {
        _onPauseCB = cb;
    };
    audioContext.pause = function () {
        originalPause.call(audioContext);
        _onPauseCB?.();
    };

    // HACK: onStop method doesn't work on runtime
    const originalStop = audioContext.stop;
    let _onStopCB: (()=> void) | null = null;
    audioContext.onStop = function (cb: ()=> void) {
        _onStopCB = cb;
    };
    audioContext.stop = function () {
        originalStop.call(audioContext);
        _onStopCB?.();
    };
    return audioContext;
};

// #region SafeArea
mg.getSafeArea = function () {
    const locSystemInfo = ral.getSystemInfoSync() as SystemInfo;
    if (locSystemInfo.safeArea) {
        return locSystemInfo.safeArea;
    } else {
        console.warn('getSafeArea is not supported on this platform');
        const systemInfo =  mg.getSystemInfoSync();
        return {
            top: 0,
            left: 0,
            bottom: systemInfo.screenHeight,
            right: systemInfo.screenWidth,
            width: systemInfo.screenWidth,
            height: systemInfo.screenHeight,
        };
    }
};
// #endregion SafeArea

export { mg };
