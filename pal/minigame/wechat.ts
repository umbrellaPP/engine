import { IMiniGame, SystemInfo } from 'pal/minigame';
import { Orientation } from '../system/enum-type/orientation';
import { cloneObject } from '../utils';

declare let wx: any;

// @ts-expect-error can't init mg when it's declared
const mg: IMiniGame = {};
cloneObject(mg, wx);

// #region SystemInfo
let _cachedSystemInfo: SystemInfo = wx.getSystemInfoSync();
// @ts-expect-error TODO: move into mg.d.ts
mg.testAndUpdateSystemInfoCache = function (testAmount: number, testInterval: number) {
    let successfullyTestTimes = 0;
    let intervalTimer: number | null = null;
    function testCachedSystemInfo () {
        const currentSystemInfo = wx.getSystemInfoSync() as SystemInfo;
        if (_cachedSystemInfo.screenWidth === currentSystemInfo.screenWidth && _cachedSystemInfo.screenHeight === currentSystemInfo.screenHeight) {
            if (++successfullyTestTimes >= testAmount && intervalTimer !== null) {
                clearInterval(intervalTimer);
                intervalTimer = null;
            }
        } else {
            successfullyTestTimes = 0;
        }
        _cachedSystemInfo = currentSystemInfo;
    }
    intervalTimer = setInterval(testCachedSystemInfo, testInterval);
};
// @ts-expect-error TODO: update when view resize
mg.testAndUpdateSystemInfoCache(10, 500);
mg.getSystemInfoSync = function () {
    return _cachedSystemInfo;
};

const systemInfo = mg.getSystemInfoSync();
mg.isDevTool = (systemInfo.platform === 'devtools');
// NOTE: size and orientation info is wrong at the init phase, especially on iOS device
Object.defineProperty(mg, 'isLandscape', {
    get () {
        const locSystemInfo = wx.getSystemInfoSync() as SystemInfo;
        if (typeof locSystemInfo.deviceOrientation === 'string') {
            return locSystemInfo.deviceOrientation.startsWith('landscape');
        } else {
            return locSystemInfo.screenWidth > locSystemInfo.screenHeight;
        }
    },
});
// init landscapeOrientation as LANDSCAPE_RIGHT
let landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
if (systemInfo.platform.toLocaleLowerCase() !== 'android') {
    // onDeviceOrientationChange doesn't work well on Android.
    // see this issue: https://developers.weixin.qq.com/community/mg/doc/000482138dc460e56cfaa5cb15bc00
    wx.onDeviceOrientationChange((res) => {
        if (res.value === 'landscape') {
            landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
        } else if (res.value === 'landscapeReverse') {
            landscapeOrientation = Orientation.LANDSCAPE_LEFT;
        }
    });
}
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
        wx.offAccelerometerChange(_accelerometerCb);
        _accelerometerCb = undefined;
    }
};
mg.startAccelerometer = function (res: any) {
    if (_accelerometerCb) {
        wx.onAccelerometerChange(_accelerometerCb);
    }
    wx.startAccelerometer(res);
};
// #endregion Accelerometer

// FIX_ME: wrong safe area when orientation is landscape left
mg.getSafeArea = function () {
    const locSystemInfo = wx.getSystemInfoSync() as SystemInfo;
    return locSystemInfo.safeArea;
};
// #endregion SafeArea

export { mg };
