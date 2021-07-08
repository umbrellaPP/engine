/*
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2020 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

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

/**
 * @packageDocumentation
 * @hidden
 */

import { Event } from '../../event';
import { EventTouch } from './events';
import { EventListener, TouchEventListener } from './event-listener';
import { Node } from '../../scene-graph';
import { macro } from '../macro';
import { legacyCC } from '../../global-exports';
import { errorID, warnID, logID, assertID } from '../debug';
import { SystemEventType, SystemEventTypeUnion } from './event-enum';
import { js } from '../../utils/js';

function checkUINode (node) {
    if (node && node.getComponent('cc.UITransform')) {
        return true;
    }
    return false;
}

const touchEvents: SystemEventTypeUnion[] = [SystemEventType.TOUCH_START, SystemEventType.TOUCH_MOVE, SystemEventType.TOUCH_END, SystemEventType.TOUCH_CANCEL];
const mouseEvents: SystemEventTypeUnion[] = [SystemEventType.MOUSE_DOWN, SystemEventType.MOUSE_MOVE, SystemEventType.MOUSE_UP, SystemEventType.MOUSE_WHEEL];

enum PriorityType {
    SCENE_GRAPH,
    FIXED,
}

class _EventListenerVector {
    public gt0Index = 0;
    private _fixedListeners: EventListener[] = [];
    private _sceneGraphListeners: EventListener[] = [];

    public size () {
        return this._fixedListeners.length + this._sceneGraphListeners.length;
    }

    public empty () {
        return (this._fixedListeners.length === 0) && (this._sceneGraphListeners.length === 0);
    }

    public push (listener: EventListener) {
        if (listener._getFixedPriority() === 0) {
            this._sceneGraphListeners.push(listener);
        } else {
            this._fixedListeners.push(listener);
        }
    }

    public clear (priorityType?: PriorityType) {
        if (typeof priorityType === 'undefined') {
            this._sceneGraphListeners.length = 0;
            this._fixedListeners.length = 0;
        } else if (priorityType === PriorityType.SCENE_GRAPH) {
            this._sceneGraphListeners.length = 0;
        } else if (priorityType === PriorityType.FIXED) {
            this._fixedListeners.length = 0;
        }
    }

    // eslint-disable-next-line consistent-return
    public getListeners (priorityType: PriorityType): EventListener[] {
        if (priorityType === PriorityType.SCENE_GRAPH) {
            return this._sceneGraphListeners;
        } else {
            return this._fixedListeners;
        }
    }
}

// Priority dirty flag
const DIRTY_NONE = 0;
const DIRTY_FIXED_PRIORITY = 1 << 0;
const DIRTY_SCENE_GRAPH_PRIORITY = 1 << 1;
const DIRTY_ALL = 3;

interface IListenerVectorMap{
    [key: number]: _EventListenerVector;
}

interface IPriorityFlag{
    [key: number]: number;
}

interface INodeListener {
    [key: string]: EventListener[];
}

class EventManager {
    private readonly _managedEventListenerTypes = [EventListener.TOUCH, EventListener.MOUSE] as const;
    private _listenerVectorMap: IListenerVectorMap = {};
    private _priorityDirtyFlagMap: IPriorityFlag = {};
    private _nodeListenersMap: INodeListener = {};
    private _toAddedListeners: EventListener[] = [];
    private _toRemovedListeners: EventListener[] = [];
    private _dirtyListeners: Record<number, boolean> = {};
    private _inDispatch = 0;
    private _isEnabled = false;
    private _currentTouch = null;
    private _currentTouchListener: any = null;

    constructor () {
        this._updateData();
    }

    /**
     * @en
     * Whether to enable dispatching events.
     *
     * @zh
     * 启用或禁用事件管理器，禁用后不会分发任何事件。
     *
     * @param enabled - 是否启用事件管理器。
     */
    public setEnabled (enabled: boolean) {
        this._isEnabled = enabled;
    }

    /**
     * @en
     * Checks whether dispatching events is enabled.
     *
     * @zh 检测事件管理器是否启用。
     *
     * @returns
     */
    public isEnabled () {
        return this._isEnabled;
    }

    /**
     * @en Pauses all listeners which are associated the specified target.
     * @zh 暂停传入的 node 相关的所有监听器的事件响应。
     * @param node - 暂停目标节点
     * @param recursive - 是否往子节点递归暂停。默认为 false。
     */
    public pauseTarget (node: Node, recursive = false) {
        if (!(node instanceof legacyCC._BaseNode)) {
            warnID(3506);
            return;
        }
        const listeners = this._nodeListenersMap[node.uuid];
        if (listeners) {
            for (let i = 0; i < listeners.length; ++i) {
                const listener = listeners[i];
                listener._setPaused(true);
            }
        }
        if (recursive === true) {
            const locChildren = node.children;
            if (locChildren) {
                for (let i = 0; i < locChildren.length; ++i) {
                    const locChild = locChildren[i];
                    this.pauseTarget(locChild, true);
                }
            }
        }
    }

    /**
     * @en
     * Resumes all listeners which are associated the specified target.
     *
     * @zh
     * 恢复传入的 node 相关的所有监听器的事件响应。
     *
     * @param node - 监听器节点。
     * @param recursive - 是否往子节点递归。默认为 false。
     */
    public resumeTarget (node: Node, recursive = false) {
        if (!(node instanceof legacyCC._BaseNode)) {
            warnID(3506);
            return;
        }
        const listeners = this._nodeListenersMap[node.uuid];
        if (listeners) {
            for (let i = 0; i < listeners.length; ++i) {
                const listener = listeners[i];
                listener._setPaused(false);
            }
        }
        this._setDirtyForNode(node);
        if (recursive === true && node.children.length > 0) {
            const locChildren = node.children;
            if (locChildren) {
                for (let i = 0; i < locChildren.length; ++i) {
                    const locChild = locChildren[i];
                    this.resumeTarget(locChild, true);
                }
            }
        }
    }

    private _getListenerTypeByEvent (event: Event): number {
        const type = event.type;
        if (mouseEvents.includes(type)) {
            return EventListener.MOUSE;
        }
        if (touchEvents.includes(type)) {
            return EventListener.TOUCH;
        }
        return EventListener.UNKNOWN;
    }

    private _getListenerPriorityType (listener: EventListener): PriorityType {
        return listener._getFixedPriority() === 0 ? PriorityType.SCENE_GRAPH : PriorityType.FIXED;
    }

    private _isDispatching () {
        return this._inDispatch !== 0;
    }

    private _updateData () {
        this._resetMap();
        this._doAddListeners();
        this._doRemoveListeners();
    }

    private _resetMap () {
        this._managedEventListenerTypes.forEach((listenerType) => {
            this._priorityDirtyFlagMap[listenerType] = DIRTY_NONE;
            this._listenerVectorMap[listenerType] = this._listenerVectorMap[listenerType] || new _EventListenerVector();
            this._listenerVectorMap[listenerType].clear();
        });
    }

    private _doAddListeners () {
        const toAddedListeners = this._toAddedListeners;
        if (toAddedListeners.length === 0) {
            return;
        }

        for (let i = 0, len = toAddedListeners.length; i < len; ++i) {
            const listener = toAddedListeners[i];
            const listenerType = listener._getType();
            const listenerVector = this._listenerVectorMap[listenerType];
            listenerVector.push(listener);

            if (listener._getFixedPriority() === 0) {
                this._setDirty(listenerType, DIRTY_SCENE_GRAPH_PRIORITY);

                const node: any = listener._getSceneGraphPriority();
                if (node === null) {
                    logID(3507);
                }

                this._associateNodeAndEventListener(node, listener);
                if (node.activeInHierarchy) {
                    this.resumeTarget(node);
                }
            } else {
                this._setDirty(listenerType, DIRTY_FIXED_PRIORITY);
            }
        }
    }

    private _doRemoveListeners () {
        const toRemovedListeners = this._toRemovedListeners;
        if (toRemovedListeners.length === 0) {
            return;
        }
        for (let i = 0; i < toRemovedListeners.length; ++i) {
            const selListener = toRemovedListeners[i];
            const listenerVector = this._listenerVectorMap[selListener._getType()];
            if (!listenerVector) {
                continue;
            }

            const fixedPriorityListeners = listenerVector.getFixedPriorityListeners();
            const sceneGraphPriorityListeners = listenerVector.getSceneGraphPriorityListeners();

            if (sceneGraphPriorityListeners) {
                const idx = sceneGraphPriorityListeners.indexOf(selListener);
                if (idx !== -1) {
                    sceneGraphPriorityListeners.splice(idx, 1);
                }
            }
            if (fixedPriorityListeners) {
                const idx = fixedPriorityListeners.indexOf(selListener);
                if (idx !== -1) {
                    fixedPriorityListeners.splice(idx, 1);
                }
            }
        }
        toRemovedListeners.length = 0;
    }

    /**
     * @en
     * <p>
     * Adds a event listener for a specified event.<br/>
     * if the parameter "nodeOrPriority" is a node,
     * it means to add a event listener for a specified event with the priority of scene graph.<br/>
     * if the parameter "nodeOrPriority" is a Number,
     * it means to add a event listener for a specified event with the fixed priority.<br/>
     * </p>
     *
     * @zh
     * 将事件监听器添加到事件管理器中。<br/>
     * 如果参数 “nodeOrPriority” 是节点，优先级由 node 的渲染顺序决定，显示在上层的节点将优先收到事件。<br/>
     * 如果参数 “nodeOrPriority” 是数字，优先级则固定为该参数的数值，数字越小，优先级越高。<br/>
     *
     * @param listener - 指定事件监听器。
     * @param nodeOrPriority - 监听程序的优先级。
     * @returns {boolean} 是否注册成功
     */
    public addListener (listener: EventListener, nodeOrPriority: Node | number): boolean {
        if (listener._isRegistered()) {
            logID(3505);
            return false;
        }
        if (!listener.checkAvailable()) {
            return false;
        }

        if (typeof nodeOrPriority === 'number') {
            if (nodeOrPriority === 0) {
                logID(3500);
                return false;
            }

            listener._setSceneGraphPriority(null);
            listener._setFixedPriority(nodeOrPriority);
        } else {
            if (!checkUINode(nodeOrPriority)) {
                logID(3512);
                return false;
            }
            listener._setSceneGraphPriority(nodeOrPriority);
            listener._setFixedPriority(0);
        }
        listener._setRegistered(true);
        listener._setPaused(false);
        if (!this._isDispatching()) {
            this._forceAddEventListener(listener);
        } else {
            this._toAddedListeners.push(listener);
        }

        return true;
    }

    /**
     * @en
     * Remove a listener.
     *
     * @zh
     * 移除一个已添加的监听器。
     *
     * @param listener - 需要移除的监听器。
     * @returns {boolean} 是否移除成功
     */
    public removeListener (listener: EventListener) {
        const targetPriorityType = this._getListenerPriorityType(listener);
        const listenerVectorMap = this._listenerVectorMap;
        if (listener === this._currentTouchListener) {
            this._currentTouchListener = this._currentTouch = null;
        }
        const listenerVector = listenerVectorMap[listener._getType()];
        const listeners = listenerVector.getListeners(targetPriorityType);
        for (let i = listeners.length - 1; i >= 0; --i) {
            const selListener = listeners[i];
            if (selListener === listener) {
                selListener._setPaused(true);
                selListener._setRegistered(false);
                if (this._getListenerPriorityType(selListener) === PriorityType.SCENE_GRAPH) {
                    this._dissociateNodeAndEventListener(selListener._getSceneGraphPriority()!, selListener);
                    // NULL out the node pointer so we don't have any dangling pointers to destroyed nodes.
                    selListener._setSceneGraphPriority(null);
                }
                if (!this._isDispatching()) {
                    js.array.removeAt(listeners, i);
                } else {
                    this._toRemovedListeners.push(selListener);
                }
                return true;
            }
        }
        // If remove failed, maybe the listener is in toAddedListeners
        const toAddedListeners = this._toAddedListeners;
        for (let i = toAddedListeners.length - 1; i >= 0; i--) {
            const selListener = toAddedListeners[i];
            if (selListener === listener) {
                js.array.removeAt(toAddedListeners, i);
                selListener._setRegistered(false);
                break;
            }
        }
        return false;
        // TODO: remember to set dirty after do remove or add listener

        // isFound = this._removeListenerInVector(sceneGraphPriorityListeners, listener);
        // if (isFound) {
        //     // fixed #4160: Dirty flag need to be updated after listeners were removed.
        //     this._setDirty(listener._getType(), DIRTY_SCENE_GRAPH_PRIORITY);
        // } else {
        //     isFound = this._removeListenerInVector(fixedPriorityListeners, listener);
        //     if (isFound) {
        //         this._setDirty(listener._getType(), DIRTY_FIXED_PRIORITY);
        //     }
        // }
    }

    /**
     * @en
     * Removes all listeners with the same event listener type or removes all listeners of a node.
     *
     * @zh
     * 移除注册到 eventManager 中指定类型的所有事件监听器。<br/>
     * 1. 如果传入的第一个参数类型是 Node，那么事件管理器将移除与该对象相关的所有事件监听器。
     * （如果第二参数 recursive 是 true 的话，就会连同该对象的子控件上所有的事件监听器也一并移除）<br/>
     * 2. 如果传入的第一个参数类型是 Number（该类型 EventListener 中定义的事件类型），
     * 那么事件管理器将移除该类型的所有事件监听器。<br/>
     *
     * 下列是目前存在监听器类型：       <br/>
     * `EventListener.UNKNOWN`      <br/>
     * `EventListener.TOUCH`        <br/>
     * `EventListener.MOUSE`        <br/>
     *
     * @param listenerType - 监听器类型。
     * @param recursive - 递归子节点的同类型监听器一并移除。默认为 false。
     */
    public removeListeners (listenerType: number | any, recursive = false) {
        if (!(legacyCC.js.isNumber(listenerType) || listenerType instanceof legacyCC._BaseNode)) {
            warnID(3506);
            return;
        }
        if (listenerType._id !== undefined) {
            // Ensure the node is removed from these immediately also.
            // Don't want any dangling pointers or the possibility of dealing with deleted objects..
            const listeners = this._nodeListenersMap[listenerType._id];
            if (listeners) {
                const listenersCopy = legacyCC.js.array.copy(listeners);
                for (let i = 0; i < listenersCopy.length; ++i) {
                    const listenerCopy = listenersCopy[i];
                    this.removeListener(listenerCopy);
                }
                delete this._nodeListenersMap[listenerType._id];
            }

            // Bug fix: ensure there are no references to the node in the list of listeners to be added.
            // If we find any listeners associated with the destroyed node in this list then remove them.
            // This is to catch the scenario where the node gets destroyed before it's listener
            // is added into the event dispatcher fully. This could happen if a node registers a listener
            // and gets destroyed while we are dispatching an event (touch etc.)
            const locToAddedListeners = this._toAddedListeners;
            for (let i = 0; i < locToAddedListeners.length;) {
                const listener = locToAddedListeners[i];
                if (listener._getSceneGraphPriority() === listenerType) {
                    // Ensure no dangling ptr to the target node.
                    listener._setSceneGraphPriority(null);
                    listener._setRegistered(false);
                    locToAddedListeners.splice(i, 1);
                } else {
                    ++i;
                }
            }

            if (recursive === true) {
                const locChildren = listenerType.getChildren();
                for (let i = 0; i < locChildren.length; ++i) {
                    const locChild = locChildren[i];
                    this.removeListeners(locChild, true);
                }
            }
        } else if (listenerType === legacyCC.EventListener.TOUCH) {
            this._removeListeners(EventListener.TOUCH);
        } else if (listenerType === legacyCC.EventListener.MOUSE) {
            this._removeListeners(EventListener.MOUSE);
        } else {
            logID(3501);
        }
    }

    /**
     * @en
     * Removes all listeners.
     *
     * @zh
     * 移除所有事件监听器。
     */
    public removeAllListeners () {
        const listenerVector = this._listenerVectorMap;
        for (const selKey in listenerVector) {
            this._removeListeners(Number.parseInt(selKey));
        }
    }

    /**
     * @en
     * Sets listener's priority with fixed value.
     *
     * @zh
     * 设置 FixedPriority 类型监听器的优先级。
     *
     * @param listener - 监听器。
     * @param fixedPriority - 优先级。
     */
    public setPriority (listener: EventListener, fixedPriority: number) {
        if (listener == null) {
            return;
        }

        const listenerVector = this._listenerVectorMap;
        for (const selKey in listenerVector) {
            const selListeners = listenerVector[selKey];
            const fixedPriorityListeners = selListeners.getFixedPriorityListeners();
            if (fixedPriorityListeners) {
                const found = fixedPriorityListeners.indexOf(listener);
                if (found !== -1) {
                    if (listener._getSceneGraphPriority() != null) {
                        logID(3502);
                    }
                    if (listener._getFixedPriority() !== fixedPriority) {
                        listener._setFixedPriority(fixedPriority);
                        this._setDirty(listener._getType(), DIRTY_FIXED_PRIORITY);
                    }
                    return;
                }
            }
        }
    }

    /**
     * @en
     * Dispatches the event, also removes all EventListeners marked for deletion from the event dispatcher list.
     *
     * @zh
     * 分发事件。
     *
     * @param event - 分发事件。
     */
    public dispatchEvent (event: Event) {
        if (!this._isEnabled) {
            return;
        }

        this._updateDirtyFlagForSceneGraph();
        this._inDispatch++;
        if (!event || !event.getType) {
            errorID(3511);
            return;
        }
        if (touchEvents.includes(event.getType())) {
            this._dispatchTouchEvent(event as EventTouch);
            this._inDispatch--;
            if (!this._isDispatching()) {
                this._updateData();
            }
            return;
        }

        const listenerType = this._getListenerTypeByEvent(event);
        this._sortEventListeners(listenerType);
        const listenerVector = this._listenerVectorMap[listenerType];
        if (listenerVector != null) {
            this._dispatchEventToListeners(listenerVector, this._onListenerCallback, event);
            this._onUpdateListeners(listenerVector);
        }

        this._inDispatch--;
        if (!this._isDispatching()) {
            this._updateData();
        }
    }

    public _onListenerCallback (listener: EventListener, event: Event) {
        event.currentTarget = listener._target;
        const onEvent = listener.onEvent;
        if (onEvent) {
            onEvent(event);
        }
        return event.isStopped();
    }

    private _setDirtyForNode (node: Node) {
        // Mark the node dirty only when there is an event listener associated with it.
        // @ts-expect-error assignment to private field
        const selListeners = this._nodeListenersMap[node._id];
        if (selListeners !== undefined) {
            for (let j = 0, len = selListeners.length; j < len; j++) {
                const selListener = selListeners[j];
                const listenerType = selListener._getType();
                if (!this._dirtyListeners[listenerType]) {
                    this._dirtyListeners[listenerType] = true;
                }
            }
        }
        if (node.children.length > 0) {
            const _children = node.children;
            for (let i = 0, len = _children ? _children.length : 0; i < len; i++) {
                this._setDirtyForNode(_children[i]);
            }
        }
    }

    private _updateDirtyFlagForSceneGraph () {
        const locDirtyListeners = this._dirtyListeners;

        // eslint-disable-next-line @typescript-eslint/no-for-in-array
        for (const selKey in locDirtyListeners) {
            this._setDirty(Number.parseInt(selKey), DIRTY_SCENE_GRAPH_PRIORITY);
            locDirtyListeners[selKey] = false;
        }
    }

    private _removeAllListenersInVector (listenerVector: EventListener[]) {
        if (!listenerVector) {
            return;
        }
        let selListener;
        for (let i = listenerVector.length - 1; i >= 0; i--) {
            selListener = listenerVector[i];
            selListener._setRegistered(false);
            if (selListener._getSceneGraphPriority() != null) {
                this._dissociateNodeAndEventListener(selListener._getSceneGraphPriority(), selListener);
                selListener._setSceneGraphPriority(null);   // NULL out the node pointer so we don't have any dangling pointers to destroyed nodes.
            }

            if (!this._isDispatching()) {
                legacyCC.js.array.removeAt(listenerVector, i);
            }
        }
    }

    private _removeListenerVector (listenerType: number) {
        const listenerVector = this._listenerVectorMap[listenerType];
        if (listenerVector) {
            const fixedPriorityListeners = listenerVector.getFixedPriorityListeners();
            const sceneGraphPriorityListeners = listenerVector.getSceneGraphPriorityListeners();

            this._removeAllListenersInVector(sceneGraphPriorityListeners);
            this._removeAllListenersInVector(fixedPriorityListeners);

            // Remove the dirty flag according the 'listenerType'.
            // No need to check whether the dispatcher is dispatching event.
            delete this._priorityDirtyFlagMap[listenerType];

            if (!this._isDispatching()) {
                listenerVector.clear();
                delete this._listenerVectorMap[listenerType];
            }
        }

        const locToAddedListeners = this._toAddedListeners;
        for (let i = locToAddedListeners.length - 1; i >= 0; i--) {
            const listener = locToAddedListeners[i];
            if (listener && listener._getType() === listenerType) {
                legacyCC.js.array.removeAt(locToAddedListeners, i);
            }
        }
    }

    private _sortEventListeners (listenerType: number) {
        let dirtyFlag = DIRTY_NONE;
        const locFlagMap = this._priorityDirtyFlagMap;
        if (locFlagMap[listenerType]) {
            dirtyFlag = locFlagMap[listenerType];
        }

        if (dirtyFlag !== DIRTY_NONE) {
            // Clear the dirty flag first, if `rootNode` is null, then set its dirty flag of scene graph priority
            locFlagMap[listenerType] = DIRTY_NONE;

            if (dirtyFlag & DIRTY_FIXED_PRIORITY) {
                this._sortListenersOfFixedPriority(listenerType);
            }

            if (dirtyFlag & DIRTY_SCENE_GRAPH_PRIORITY) {
                const rootEntity = legacyCC.director.getScene();
                if (rootEntity) {
                    this._sortListenersOfSceneGraphPriority(listenerType);
                }
            }
        }
    }

    private _sortListenersOfSceneGraphPriority (listenerType: number) {
        const listenerVector = this._listenerVectorMap[listenerType];
        if (!listenerVector) {
            return;
        }

        const sceneGraphListener = listenerVector.getSceneGraphPriorityListeners();
        if (!sceneGraphListener || sceneGraphListener.length === 0) {
            return;
        }

        // After sort: priority < 0, > 0
        const eventListeners = listenerVector.getSceneGraphPriorityListeners();
        eventListeners.forEach((listener) => {
            const node: any = listener._getSceneGraphPriority();
            const trans = node._uiProps.uiTransformComp;
            listener._cameraPriority = trans.cameraPriority;
        });
        eventListeners.sort(this._sortEventListenersOfSceneGraphPriorityDes);
    }

    private _sortEventListenersOfSceneGraphPriorityDes (l1: EventListener, l2: EventListener) {
        const node1: any = l1._getSceneGraphPriority();
        const node2: any = l2._getSceneGraphPriority();
        // Event manager should only care about ui node in the current scene hierarchy
        if (!l2 || !node2 || !node2._activeInHierarchy || !node2._uiProps.uiTransformComp) {
            return -1;
        } else if (!l1 || !node1 || !node1._activeInHierarchy || !node1._uiProps.uiTransformComp) {
            return 1;
        }

        let p1 = node1; let p2 = node2; let ex = false;
        if (l1._cameraPriority !== l2._cameraPriority) {
            return l2._cameraPriority - l1._cameraPriority;
        }
        while (p1.parent._id !== p2.parent._id) {
            p1 = p1.parent.parent === null ? (ex = true) && node2 : p1.parent;
            p2 = p2.parent.parent === null ? (ex = true) && node1 : p2.parent;
        }
        if (p1._id === p2._id) {
            if (p1._id === node2._id) {
                return -1;
            }
            if (p1._id === node1._id) {
                return 1;
            }
        }

        const priority1 = p1.getSiblingIndex();
        const priority2 = p2.getSiblingIndex();

        return ex ? priority1 - priority2 : priority2 - priority1;
    }

    private _sortListenersOfFixedPriority (listenerType: number) {
        const listenerVector = this._listenerVectorMap[listenerType];
        if (!listenerVector) {
            return;
        }

        const fixedListeners = listenerVector.getFixedPriorityListeners();
        if (!fixedListeners || fixedListeners.length === 0) {
            return;
        }
        // After sort: priority < 0, > 0
        fixedListeners.sort(this._sortListenersOfFixedPriorityAsc);

        // FIXME: Should use binary search
        let index = 0;
        for (const len = fixedListeners.length; index < len;) {
            if (fixedListeners[index]._getFixedPriority() >= 0) {
                break;
            }
            ++index;
        }
        listenerVector.gt0Index = index;
    }

    private _sortListenersOfFixedPriorityAsc (l1: EventListener, l2: EventListener) {
        return l1._getFixedPriority() - l2._getFixedPriority();
    }

    private _onUpdateListeners (listeners: _EventListenerVector) {
        const fixedPriorityListeners = listeners.getFixedPriorityListeners();
        const sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();
        const toRemovedListeners = this._toRemovedListeners;

        if (sceneGraphPriorityListeners) {
            for (let i = sceneGraphPriorityListeners.length - 1; i >= 0; i--) {
                const selListener = sceneGraphPriorityListeners[i];
                if (!selListener._isRegistered()) {
                    legacyCC.js.array.removeAt(sceneGraphPriorityListeners, i);
                    // if item in toRemove list, remove it from the list
                    const idx = toRemovedListeners.indexOf(selListener);
                    if (idx !== -1) {
                        toRemovedListeners.splice(idx, 1);
                    }
                }
            }
        }

        if (fixedPriorityListeners) {
            for (let i = fixedPriorityListeners.length - 1; i >= 0; i--) {
                const selListener = fixedPriorityListeners[i];
                if (!selListener._isRegistered()) {
                    legacyCC.js.array.removeAt(fixedPriorityListeners, i);
                    // if item in toRemove list, remove it from the list
                    const idx = toRemovedListeners.indexOf(selListener);
                    if (idx !== -1) {
                        toRemovedListeners.splice(idx, 1);
                    }
                }
            }
        }

        if (sceneGraphPriorityListeners && sceneGraphPriorityListeners.length === 0) {
            listeners.clearSceneGraphListeners();
        }

        if (fixedPriorityListeners && fixedPriorityListeners.length === 0) {
            listeners.clearFixedListeners();
        }
    }

    private _updateTouchListeners (event) {
        const locInDispatch = this._inDispatch;
        assertID(locInDispatch > 0, 3508);

        if (locInDispatch > 1) {
            return;
        }

        const listenerVector = this._listenerVectorMap[EventListener.TOUCH];
        if (listenerVector) {
            this._onUpdateListeners(listenerVector);
        }

        assertID(locInDispatch === 1, 3509);

        const locToAddedListeners = this._toAddedListeners;
        if (locToAddedListeners.length !== 0) {
            for (let i = 0, len = locToAddedListeners.length; i < len; i++) {
                this._forceAddEventListener(locToAddedListeners[i]);
            }
            this._toAddedListeners.length = 0;
        }

        if (this._toRemovedListeners.length !== 0) {
            this._cleanToRemovedListeners();
        }
    }

    private _onTouchEventCallback (listener: TouchEventListener, argsObj: any) {
        // Skip if the listener was removed.
        if (!listener._isRegistered()) {
            return false;
        }

        const event = argsObj.event;
        const selTouch = event.touch;
        event.currentTarget = listener._getSceneGraphPriority();

        let isClaimed = false;
        let removedIdx = -1;
        const eventType = event.type;
        if (eventType === SystemEventType.TOUCH_START) {
            if (!macro.ENABLE_MULTI_TOUCH && eventManager._currentTouch) {
                const node = eventManager._currentTouchListener._node;
                if (!node || node.activeInHierarchy) {
                    return false;
                }
            }
            if (listener.onTouchBegan) {
                isClaimed = listener.onTouchBegan(selTouch, event);
                if (isClaimed && listener._isRegistered() && !listener._isPaused()) {
                    listener._claimedTouches.push(selTouch);
                    if (macro.ENABLE_MULTI_TOUCH || !eventManager._currentTouch) {
                        eventManager._currentTouch = selTouch;
                    }

                    eventManager._currentTouchListener = listener;
                }
            }
        } else if (listener._claimedTouches.length > 0) {
            removedIdx = listener._claimedTouches.indexOf(selTouch);
            if (removedIdx !== -1) {
                isClaimed = true;
                if (!macro.ENABLE_MULTI_TOUCH && eventManager._currentTouch && eventManager._currentTouch !== selTouch) {
                    return false;
                }
                if (eventType === SystemEventType.TOUCH_MOVE && listener.onTouchMoved) {
                    listener.onTouchMoved(selTouch, event);
                } else if (eventType === SystemEventType.TOUCH_END) {
                    if (listener.onTouchEnded) {
                        listener.onTouchEnded(selTouch, event);
                    }
                    if (listener._isRegistered()) {
                        listener._claimedTouches.splice(removedIdx, 1);
                    }

                    if (macro.ENABLE_MULTI_TOUCH || eventManager._currentTouch === selTouch) {
                        eventManager._currentTouch = null;
                    }

                    eventManager._currentTouchListener = null;
                } else if (eventType === SystemEventType.TOUCH_CANCEL) {
                    if (listener.onTouchCancelled) {
                        listener.onTouchCancelled(selTouch, event);
                    }
                    if (listener._isRegistered()) {
                        listener._claimedTouches.splice(removedIdx, 1);
                    }

                    if (macro.ENABLE_MULTI_TOUCH || eventManager._currentTouch === selTouch) {
                        eventManager._currentTouch = null;
                    }

                    eventManager._currentTouchListener = null;
                }
            }
        }

        // If the event was stopped, return directly.
        if (event.isStopped()) {
            eventManager._updateTouchListeners(event);
            return true;
        }

        if (isClaimed && listener._isRegistered() && listener.swallowTouches) {
            if (argsObj.needsMutableSet) {
                argsObj.touches.splice(selTouch, 1);
            }
            return true;
        }
        return false;
    }

    private _dispatchTouchEvent (event: EventTouch) {
        this._sortEventListeners(EventListener.TOUCH);
        const touchListeners = this._listenerVectorMap[EventListener.TOUCH];

        // If there aren't any touch listeners, return directly.
        if (!touchListeners) {
            return;
        }

        const originalTouches = event.getTouches();
        const mutableTouches = legacyCC.js.array.copy(originalTouches);
        const argsObj = { event, needsMutableSet: (touchListeners), touches: mutableTouches, selTouch: null };

        //
        // process the target handlers 1st
        //
        if (touchListeners) {
            for (let i = 0; i < originalTouches.length; ++i) {
                const originalTouch = originalTouches[i];
                event.touch = originalTouch;
                event.propagationStopped = event.propagationImmediateStopped = false;
                this._dispatchEventToListeners(touchListeners, this._onTouchEventCallback, argsObj);
            }
        }

        this._updateTouchListeners(event);
    }

    private _associateNodeAndEventListener (node: Node, listener: EventListener) {
        let listeners = this._nodeListenersMap[node.uuid];
        if (!listeners) {
            listeners = [];
            this._nodeListenersMap[node.uuid] = listeners;
        }
        listeners.push(listener);
    }

    private _dissociateNodeAndEventListener (node: Node, listener: EventListener) {
        const listeners = this._nodeListenersMap[node.uuid];
        if (listeners) {
            js.array.remove(listeners, listener);
            if (listeners.length === 0) {
                delete this._nodeListenersMap[node.uuid];
            }
        }
    }

    private _dispatchEventToListeners (listeners: _EventListenerVector, onEvent: (listener:any, eventOrArgs:any)=>boolean, eventOrArgs: any) {
        let shouldStopPropagation = false;
        const fixedPriorityListeners = listeners.getFixedPriorityListeners();
        const sceneGraphPriorityListeners = listeners.getSceneGraphPriorityListeners();

        let i = 0;
        if (fixedPriorityListeners) {  // priority < 0
            if (fixedPriorityListeners.length !== 0) {
                for (; i < listeners.gt0Index; ++i) {
                    const selListener = fixedPriorityListeners[i];
                    if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                        shouldStopPropagation = true;
                        break;
                    }
                }
            }
        }

        if (sceneGraphPriorityListeners && !shouldStopPropagation) {    // priority == 0, scene graph priority
            for (let i = 0; i < sceneGraphPriorityListeners.length; ++i) {
                const selListener = sceneGraphPriorityListeners[i];
                if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                    shouldStopPropagation = true;
                    break;
                }
            }
        }

        if (fixedPriorityListeners && !shouldStopPropagation) {    // priority > 0
            for (; i < fixedPriorityListeners.length; ++i) {
                const selListener = fixedPriorityListeners[i];
                if (selListener.isEnabled() && !selListener._isPaused() && selListener._isRegistered() && onEvent(selListener, eventOrArgs)) {
                    shouldStopPropagation = true;
                    break;
                }
            }
        }
    }

    private _setDirty (listenerType: number, flag) {
        const locDirtyFlagMap = this._priorityDirtyFlagMap;
        if (locDirtyFlagMap[listenerType] == null) {
            locDirtyFlagMap[listenerType] = flag;
        } else {
            locDirtyFlagMap[listenerType] |= flag;
        }
    }
}

/**
 * @en
 * This class has been deprecated, please use `systemEvent` or `EventTarget` instead.
 * See [Listen to and launch events](../../../manual/en/scripting/events.html) for details.<br>
 * <br>
 * `eventManager` is a singleton object which manages event listener subscriptions and event dispatching.
 * The EventListener list is managed in such way so that event listeners can be added and removed
 * while events are being dispatched.
 *
 * @zh
 * 该类已废弃，请使用 `systemEvent` 或 `EventTarget` 代替，详见 [监听和发射事件](../../../manual/zh/scripting/events.html)。<br>
 * <br>
 * 事件管理器，它主要管理事件监听器注册和派发系统事件。
 *
 * @class eventManager
 * @static
 * @example {@link cocos/core/event-manager/CCEventManager/addListener.js}
 * @deprecated
 */
export const eventManager = new EventManager();

legacyCC.eventManager = eventManager;

export default eventManager;
