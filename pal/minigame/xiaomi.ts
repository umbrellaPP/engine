import { IMiniGame } from 'pal/minigame';
import { Orientation } from '../system/enum-type/orientation';
import { cloneObject } from '../utils';

declare let qg: any;

// @ts-expect-error can't init mg when it's declared
const mg: IMiniGame = {};
cloneObject(mg, qg);

// #region SystemInfo
const systemInfo = mg.getSystemInfoSync();
mg.isDevTool = false;

mg.isLandscape = systemInfo.screenWidth > systemInfo.screenHeight;
// init landscapeOrientation as LANDSCAPE_RIGHT
const landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
// NOTE: onDeviceOrientationChange is not supported on this platform
// qg.onDeviceOrientationChange((res) => {
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
mg.onTouchStart = function (cb) {
    window.canvas.ontouchstart = cb;
};
mg.onTouchMove = function (cb) {
    window.canvas.ontouchmove = cb;
};
mg.onTouchEnd = function (cb) {
    window.canvas.ontouchend = cb;
};
mg.onTouchCancel = function (cb) {
    window.canvas.ontouchcancel = cb;
};
// #endregion TouchEvent

// // Keyboard
// globalAdapter.showKeyboard = function (res) {
//     res.confirmHold = true;  // HACK: confirmHold not working on Xiaomi platform
//     qg.showKeyboard(res);
// };

// #region Accelerometer
let _customAccelerometerCb: AccelerometerChangeCallback | undefined;
let _innerAccelerometerCb: AccelerometerChangeCallback | undefined;
mg.onAccelerometerChange = function (cb: AccelerometerChangeCallback) {
    // qg.offAccelerometerChange() is not supported.
    // so we can only register AccelerometerChange callback, but can't unregister.
    if (!_innerAccelerometerCb) {
        _innerAccelerometerCb = (res: any) => {
            let x = res.x;
            let y = res.y;
            if (mg.isLandscape) {
                const orientationFactor = (landscapeOrientation === Orientation.LANDSCAPE_RIGHT ? 1 : -1);
                const tmp = x;
                x = -y * orientationFactor;
                y = tmp * orientationFactor;
            }

            const standardFactor = -0.1;
            x *= standardFactor;
            y *= standardFactor;
            const resClone = {
                x,
                y,
                z: res.z,
            };
            _customAccelerometerCb?.(resClone);
        };
        qg.onAccelerometerChange(_innerAccelerometerCb);
    }
    _customAccelerometerCb = cb;
};
mg.offAccelerometerChange = function (cb?: AccelerometerChangeCallback) {
    // qg.offAccelerometerChange() is not supported.
    _customAccelerometerCb = undefined;
};
// #endregion Accelerometer

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
