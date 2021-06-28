/*
 Copyright (c) 2020 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

import { markAsWarning, removeProperty } from '../utils';
import { warnID } from './debug';
import { EventMouse, EventTouch, SystemEventType } from './event-manager';
import { sys } from './sys';
import { View } from './view';

removeProperty(View.prototype, 'View.prototype', [
    {
        name: 'isAntiAliasEnabled',
        suggest: 'The API of Texture2d have been largely modified, no alternative',
    },
    {
        name: 'enableAntiAlias',
        suggest: 'The API of Texture2d have been largely modified, no alternative',
    },
]);

// depracate EventMouse static property
['DOWN', 'UP', 'MOVE'].forEach((item) => {
    Object.defineProperty(EventMouse, item, {
        get () {
            warnID(1400, `EventMouse.${item}`, `SystemEventType.MOUSE_${item}`);
            return SystemEventType[`MOUSE_${item}`] as string;
        },
    });
});
Object.defineProperty(EventMouse, 'SCROLL', {
    get () {
        warnID(1400, `EventMouse.SCROLL`, `SystemEventType.MOUSE_WHEEL`);
        return SystemEventType.MOUSE_WHEEL;
    },
});

// depracate EventTouch static property
Object.defineProperty(EventTouch, 'BEGAN', {
    get () {
        warnID(1400, `EventMouse.BEGAN`, `SystemEventType.TOUCH_START`);
        return SystemEventType.TOUCH_START;
    },
});
Object.defineProperty(EventTouch, 'MOVED', {
    get () {
        warnID(1400, `EventMouse.MOVED`, `SystemEventType.TOUCH_MOVE`);
        return SystemEventType.TOUCH_MOVE;
    },
});
Object.defineProperty(EventTouch, 'ENDED', {
    get () {
        warnID(1400, `EventMouse.ENDED`, `SystemEventType.TOUCH_END`);
        return SystemEventType.TOUCH_END;
    },
});
Object.defineProperty(EventTouch, 'CANCELLED', {
    get () {
        warnID(1400, `EventMouse.CANCELLED`, `SystemEventType.TOUCH_CANCEL`);
        return SystemEventType.TOUCH_CANCEL;
    },
});

// deprecate languageCode field
['UNKNOWN', 'ENGLISH', 'CHINESE', 'FRENCH', 'ITALIAN',
    'GERMAN', 'SPANISH', 'DUTCH', 'RUSSIAN', 'KOREAN',
    'JAPANESE', 'HUNGARIAN', 'PORTUGUESE', 'ARABIC', 'NORWEGIAN',
    'POLISH', 'TURKISH', 'UKRAINIAN', 'ROMANIAN', 'BULGARIAN'].forEach((item) => {
    Object.defineProperty(sys, `LANGUAGE_${item}`, {
        get () {
            warnID(1400, `sys.LANGUAGE_${item}`, `sys.Language.${item}`);
            return sys.Language[item] as string;
        },
    });
});

// deprecate os field
['UNKNOWN', 'IOS', 'ANDROID', 'WINDOWS', 'LINUX', 'OSX'].forEach((item) => {
    Object.defineProperty(sys, `OS_${item}`, {
        get () {
            warnID(1400, `sys.OS_${item}`, `sys.OS.${item}`);
            return sys.OS[item] as string;
        },
    });
});

// deprecate browserType field
['UNKNOWN', 'WECHAT', 'ANDROID', 'IE', 'EDGE', 'QQ', 'MOBILE_QQ',
    'UC', 'UCBS', 'BAIDU_APP', 'BAIDU', 'MAXTHON', 'OPERA',
    'OUPENG', 'MIUI', 'FIREFOX', 'SAFARI', 'CHROME', 'LIEBAO',
    'QZONE', 'SOUGOU', 'HUAWEI'].forEach((item) => {
    Object.defineProperty(sys, `BROWSER_TYPE_${item}`, {
        get () {
            warnID(1400, `sys.BROWSER_TYPE_${item}`, `sys.BrowserType.${item}`);
            return sys.BrowserType[item] as string;
        },
    });
});
Object.defineProperty(sys, 'BROWSER_TYPE_360', {
    get () {
        warnID(1400, 'sys.BROWSER_TYPE_360', `sys.BrowserType.BROWSER_360`);
        return sys.BrowserType.BROWSER_360 as string;
    },
});

// deprecate platform field
['UNKNOWN', 'EDITOR_PAGE', 'EDITOR_CORE', 'MOBILE_BROWSER', 'DESKTOP_BROWSER', 'WIN32', 'MACOS', 'IOS', 'ANDROID',
    'WECHAT_GAME', 'BAIDU_MINI_GAME', 'XIAOMI_QUICK_GAME', 'ALIPAY_MINI_GAME', 'BYTEDANCE_MINI_GAME',
    'OPPO_MINI_GAME', 'VIVO_MINI_GAME', 'HUAWEI_QUICK_GAME', 'COCOSPLAY',  'LINKSURE_MINI_GAME', 'QTT_MINI_GAME'].forEach((item) => {
    Object.defineProperty(sys, item, {
        get () {
            warnID(1400, `sys.${item}`, `sys.Platform.${item}`);
            return sys.Platform[item] as string;
        },
    });
});

// remove platform field
replaceProperty(sys, 'sys', [
    {
        name: 'IPHONE',
        newName: 'IOS',
        target: sys.Platform,
        targetName: 'sys.Platform',
    },
    {
        name: 'IPAD',
        newName: 'IOS',
        target: sys.Platform,
        targetName: 'sys.Platform',
    },
]);
removeProperty(sys, 'sys',
    ['LINUX', 'BLACKBERRY', 'NACL', 'EMSCRIPTEN', 'TIZEN',
        'WINRT', 'WP8', 'QQ_PLAY', 'FB_PLAYABLE_ADS'].map((item) => ({
        name: item,
    })));
