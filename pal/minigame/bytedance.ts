import { IMiniGame, SystemInfo } from 'pal/minigame';
import { Orientation } from '../system/enum-type/orientation';
import { cloneObject } from '../utils';

declare let tt: any;

// @ts-expect-error can't init mg when it's declared
const mg: IMiniGame = {};
cloneObject(mg, tt);

// #region SystemInfo
const systemInfo = mg.getSystemInfoSync();
mg.isDevTool = (systemInfo.platform === 'devtools');

mg.isLandscape = systemInfo.screenWidth > systemInfo.screenHeight;
// init landscapeOrientation as LANDSCAPE_RIGHT
let landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
tt.onDeviceOrientationChange((res) => {
    if (res.value === 'landscape') {
        landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
    } else if (res.value === 'landscapeReverse') {
        landscapeOrientation = Orientation.LANDSCAPE_LEFT;
    }
});
Object.defineProperty(mg, 'orientation', {
    get () {
        return mg.isLandscape ? landscapeOrientation : Orientation.PORTRAIT;
    },
});
// #endregion SystemInfo

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
        tt.offAccelerometerChange(_accelerometerCb);
        _accelerometerCb = undefined;
    }
};
mg.startAccelerometer = function (res: any) {
    if (_accelerometerCb) {
        tt.onAccelerometerChange(_accelerometerCb);
    }
    tt.startAccelerometer(res);
};
// #endregion Accelerometer

mg.getSafeArea = function () {
    const locSystemInfo = tt.getSystemInfoSync() as SystemInfo;
    let { top, left, right } = locSystemInfo.safeArea;
    const { bottom, width, height } = locSystemInfo.safeArea;
    // HACK: on iOS device, the orientation should mannually rotate
    if (locSystemInfo.platform === 'ios' && !mg.isDevTool && mg.isLandscape) {
        const tmpTop = top; const tmpLeft = left; const tmpBottom = bottom; const tmpRight = right; const tmpWidth = width; const tmpHeight = height;
        top = tmpLeft;
        left = tmpTop;
        right = tmpRight - tmpTop;
    }
    return { top, left, bottom, right, width, height };
};
// #endregion SafeArea

export { mg };
