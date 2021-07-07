class EventManager {
    public setEnabled (enabled: boolean);
    public isEnabled (): boolean;
    public pauseTarget (node: Node, recursive: boolean);
    public resumeTarget (node: Node, recursive: boolean);
    // frameUpdateListeners -> update after dispatching
    private _doUpdateMap();
    private _doAddListeners () // private _forceAddEventListener (listener: EventListener);
    private _doRemoveListeners () // private _cleanToRemovedListeners ()
    private getListeners (listenerType: number); // private _getListeners (listenerType: number);
    public hasEventListener (listenerType: number);
    // private _addListener (listener: EventListener);  // 还没有 add
    public addListener (listener: EventListener, nodeOrPriority: any | number): EventListener | null;  // listener 状态初始化 ，还没有 add
    public removeListener (listener: EventListener);
    private _removeListenerInVector (listeners: EventListener[], listener: EventListener) 

    // public removeListeners (listenerType: number | any, recursive = false);
    public removeListenersByType (listenerType: number);  // private _removeListeners (listenerType: number);
    public removeListenersByNode (node: number | any, recursive = false);
    public removeAllListeners ();

    // public addCustomListener (eventName: string, callback: ()=>void) 
    // public removeCustomListeners (customEventName)
    // public dispatchCustomEvent (eventName, optionalUserData)

    public setPriority (listener: EventListener, fixedPriority: number);

    public dispatchEvent (event: Event);
    private _dispatchTouchEvent (event: EventTouch) 
    private _dispatchEventToListeners (listeners: _EventListenerVector, onEvent: (listener:any, eventOrArgs:any)=>boolean, eventOrArgs: any)
    // public _onListenerCallback(listener: EventListener, event: Event);
    // private _onTouchEventCallback (listener: TouchEventListener, argsObj: any)
    // 应该只有一个 onEvent

    private _setDirty (listenerType: number, flag) 
    private _setDirtyForNode (node: Node);
    private _updateDirtyFlagForSceneGraph ();


    private _removeAllListenersInVector (listenerVector: EventListener[]);

    private _sortEventListeners (listenerType: number)
    private _sortListenersOfSceneGraphPriority (listenerType: number)
    private _sortEventListenersOfSceneGraphPriorityDes (l1: EventListener, l2: EventListener) 
    private _sortListenersOfFixedPriority (listenerType: number)
    private _sortListenersOfFixedPriorityAsc (l1: EventListener, l2: EventListener)

    private _onUpdateListeners (listeners: _EventListenerVector)  // ？？
    private _updateTouchListeners (event) 
    
    // private _associateNodeAndEventListener (node: Node, listener: EventListener) 
    // private _dissociateNodeAndEventListener (node: Node, listener: EventListener) 
    // 应该 node 本身持有 eventListener 数组，而且不应该有 node-event-processor, eventListener 作为 node 的事件代理，就应该承包所有 node 的事件处理工作
}