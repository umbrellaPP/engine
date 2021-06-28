import { IMiniGame, SystemInfo } from 'pal/minigame';
import { Orientation } from '../system/enum-type/orientation';
import { cloneObject, createInnerAudioContextPolyfill } from '../utils';

declare let wx: any;

// @ts-expect-error can't init minigame when it's declared
const minigame: IMiniGame = {};
cloneObject(minigame, wx);

// #region SystemInfo
let _cachedSystemInfo: SystemInfo = wx.getSystemInfoSync();
// @ts-expect-error TODO: move into minigame.d.ts
minigame.testAndUpdateSystemInfoCache = function (testAmount: number, testInterval: number) {
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
minigame.testAndUpdateSystemInfoCache(10, 500);
minigame.getSystemInfoSync = function () {
    return _cachedSystemInfo;
};

const systemInfo = minigame.getSystemInfoSync();
minigame.isDevTool = (systemInfo.platform === 'devtools');
// NOTE: size and orientation info is wrong at the init phase, especially on iOS device
Object.defineProperty(minigame, 'isLandscape', {
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
    // see this issue: https://developers.weixin.qq.com/community/minigame/doc/000482138dc460e56cfaa5cb15bc00
    wx.onDeviceOrientationChange((res) => {
        if (res.value === 'landscape') {
            landscapeOrientation = Orientation.LANDSCAPE_RIGHT;
        } else if (res.value === 'landscapeReverse') {
            landscapeOrientation = Orientation.LANDSCAPE_LEFT;
        }
    });
}
Object.defineProperty(minigame, 'orientation', {
    get () {
        return minigame.isLandscape ? landscapeOrientation : Orientation.PORTRAIT;
    },
});
// #endregion SystemInfo

// #region Accelerometer
let _accelerometerCb: AccelerometerChangeCallback | undefined;
minigame.onAccelerometerChange = function (cb: AccelerometerChangeCallback) {
    minigame.offAccelerometerChange();
    // onAccelerometerChange would start accelerometer
    // so we won't call this method here
    _accelerometerCb = (res: any) => {
        let x = res.x;
        let y = res.y;
        if (minigame.isLandscape) {
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
minigame.offAccelerometerChange = function (cb?: AccelerometerChangeCallback) {
    if (_accelerometerCb) {
        wx.offAccelerometerChange(_accelerometerCb);
        _accelerometerCb = undefined;
    }
};
minigame.startAccelerometer = function (res: any) {
    if (_accelerometerCb) {
        wx.onAccelerometerChange(_accelerometerCb);
    }
    wx.startAccelerometer(res);
};
// #endregion Accelerometer

// minigame.createInnerAudioContext = createInnerAudioContextPolyfill(wx, {
//     onPlay: true,
//     onPause: true,
//     onStop: true,
//     onSeek: false,
// });

// TODO: move to createInnerAudioContextPolyfill()
minigame.createInnerAudioContext = function () {
    const audioContext: InnerAudioContext = wx.createInnerAudioContext();

    // add polyfill if onPlay method doesn't work this platform
    const originalPlay = audioContext.play;
    let _onPlayCB: (()=> void) | null = null;
    Object.defineProperty(audioContext, 'onPlay', {
        value (cb: ()=> void) {
            _onPlayCB = cb;
        },
    });
    Object.defineProperty(audioContext, 'play', {
        value () {
            originalPlay.call(audioContext);
            if (_onPlayCB) {
                setTimeout(_onPlayCB, 0);
            }
        },
    });

    // add polyfill if onPause method doesn't work this platform
    const originalPause = audioContext.pause;
    let _onPauseCB: (()=> void) | null = null;
    Object.defineProperty(audioContext, 'onPause', {
        value (cb: ()=> void) {
            _onPauseCB = cb;
        },
    });
    Object.defineProperty(audioContext, 'pause', {
        value () {
            originalPause.call(audioContext);
            if (_onPauseCB) {
                setTimeout(_onPauseCB, 0);
            }
        },
    });

    // add polyfill if onStop method doesn't work on this platform
    const originalStop = audioContext.stop;
    let _onStopCB: (()=> void) | null = null;
    Object.defineProperty(audioContext, 'onStop', {
        value (cb: ()=> void) {
            _onStopCB = cb;
        },
    });
    Object.defineProperty(audioContext, 'stop', {
        value () {
            originalStop.call(audioContext);
            if (_onStopCB) {
                setTimeout(_onStopCB, 0);
            }
        },
    });

    return audioContext;
};

// #region SafeArea
// FIX_ME: wrong safe area when orientation is landscape left
minigame.getSafeArea = function () {
    const locSystemInfo = wx.getSystemInfoSync() as SystemInfo;
    return locSystemInfo.safeArea;
};
// #endregion SafeArea

export { minigame };
