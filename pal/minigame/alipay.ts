import { IMiniGame, SystemInfo } from 'pal/minigame';
import { Orientation } from '../system/enum-type/orientation';
import { cloneObject } from '../utils';

declare let my: any;

// @ts-expect-error can't init mg when it's declared
const mg: IMiniGame = {};
cloneObject(mg, my);

// #region SystemInfo
const systemInfo = mg.getSystemInfoSync();
mg.isDevTool = window.navigator && (/AlipayIDE/.test(window.navigator.userAgent));

mg.isLandscape = systemInfo.screenWidth > systemInfo.screenHeight;
// init landscapeOrientation as LANDSCAPE_RIGHT
const landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
// NOTE: onDeviceOrientationChange is not supported on this platform
// my.onDeviceOrientationChange((res) => {
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
// #endregion SystemInfo

// #region TouchEvent
// my.onTouchStart register touch event listner on body
// need to register on canvas
mg.onTouchStart = function (cb) {
    window.canvas.addEventListener('touchstart', (res) => {
        cb && cb(res);
    });
};
mg.onTouchMove = function (cb) {
    window.canvas.addEventListener('touchmove', (res) => {
        cb && cb(res);
    });
};
mg.onTouchEnd = function (cb) {
    window.canvas.addEventListener('touchend', (res) => {
        cb && cb(res);
    });
};
mg.onTouchCancel = function (cb) {
    window.canvas.addEventListener('touchcancel', (res) => {
        cb && cb(res);
    });
};
// #endregion TouchEvent

mg.createInnerAudioContext = function (): InnerAudioContext {
    const audio: InnerAudioContext = my.createInnerAudioContext();
    // @ts-expect-error InnerAudioContext has onCanPlay
    audio.onCanplay = audio.onCanPlay.bind(audio);
    // @ts-expect-error InnerAudioContext has offCanPlay
    audio.offCanplay = audio.offCanPlay.bind(audio);
    // @ts-expect-error InnerAudioContext has onCanPlay
    delete audio.onCanPlay;
    // @ts-expect-error InnerAudioContext has offCanPlay
    delete audio.offCanPlay;
    return audio;
};

mg.loadFont = function (url) {
    // my.loadFont crash when url is not in user data path
    return 'Arial';
};
// #endregion Font

// #region Accelerometer
let _accelerometerCb: AccelerometerChangeCallback | undefined;
mg.onAccelerometerChange = function (cb: AccelerometerChangeCallback) {
    mg.offAccelerometerChange();
    // onAccelerometerChange would start accelerometer
    // so we won't call this method here
    _accelerometerCb = (res: any) => {
        let x = res.x;
        let y = res.y;
        if (mg.isLandscape) {
            const orientationFactor = (landscapeOrientation === Orientation.LANDSCAPE_RIGHT ? 1 : -1);
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
    };
};
mg.offAccelerometerChange = function (cb?: AccelerometerChangeCallback) {
    if (_accelerometerCb) {
        my.offAccelerometerChange(_accelerometerCb);
        _accelerometerCb = undefined;
    }
};
mg.startAccelerometer = function (res: any) {
    if (_accelerometerCb) {
        my.onAccelerometerChange(_accelerometerCb);
    } else {
        // my.startAccelerometer() is not implemented.
        console.error('mg.onAccelerometerChange() should be invoked before mg.startAccelerometer() on alipay platform');
    }
};
mg.stopAccelerometer = function (res: any) {
    // my.stopAccelerometer() is not implemented.
    mg.offAccelerometerChange();
};
// #endregion Accelerometer

// #region SafeArea
mg.getSafeArea = function () {
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
};
// #endregion SafeArea

export { mg };
