/* See license.txt for terms of usage */

function dispatcher() {
    // If listeners are added, this function is replaced with the real dispatcher. Otherwise,
    // dispatching an event calls this and (obviously) nothing happens.
}

dispatcher.dom = function(eventName, bubbles, cancelable) {
    return function(event) {
        var target = event.target;
        if (target && target.length) {
            var domEvent = new CustomEvent(eventName, {detail: event, bubbles: bubbles,
                                                       cancelable: cancelable});
            target.val().dispatchEvent(domEvent);
        }
    }
}

dispatcher.create = function(already, shouldPropagate) {
    function fn(event) {
        if (already || this.ready) {
            fn.dispatch(event);            
        }
    }

    var listeners;
    
    fn.addListener = function(cb) {
        if (!listeners) {
            listeners = [cb];
        } else {
            listeners.push(cb);
        }
    }

    fn.removeListener = function(cb) {
        if (listeners) {
            var index = listeners.indexOf(cb);
            if (index != -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    fn.dispatch = function(event) {
        if (listeners && !fn.disabled) {
            for (var i = 0; i < listeners.length; ++i) {
                listeners[i](event);
            }
        }
    };

    return fn;
};

exports.event = dispatcher;
