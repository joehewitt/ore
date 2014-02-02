/* See license.txt for terms of usage */

function broadcaster() {}

broadcaster.create = function(already) {
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
            listeners[listeners.length] = cb;
        }
    }
    
    fn.dispatch = function(event) {
        if (listeners) {
            for (var i = 0; i < listeners.length; ++i) {
                listeners[i](event);
            }
        }
    };

    return fn;
};

exports.event = broadcaster;
