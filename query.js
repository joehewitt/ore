/* See license.txt for terms of usage */

has("string-trim");
// has("dom-queryselector");
has("dom-addeventlistener");

var _ = require('underscore'),
    fool = require('fool'),
    events = require('./events'),
    bindings = require('./bindings'),
    Bindable = bindings.Bindable;

var cssNumber = {
    'z-index': true,
    '-webkit-flex': true,
    'font-weight': true,
    opacity: true,
    zoom: true,
    'line-height': true
};

// *************************************************************************************************

function query(selector, context) {
    if (selector === 'body') {
        return wrap(document.body);
    } else if (typeof selector === 'string') {
        if (!context && /^#([\w\-]+)$/.exec(selector)) {
            // Shortcut for getting element by id
            return wrapSet([document.getElementById(selector.substr(1))]);
        } else {
            var node = context ? unwrap(context) : document;
            return wrapSet(query.slice(node.querySelectorAll
                ? node.querySelectorAll(selector)
                : document.querySelectorAll.call(node, selector)), 0);
        }
    } else {
        return wrap(selector);
    }
}

module.exports = query;

// *************************************************************************************************

_.extend(query, events);
_.extend(query, bindings);

var slice = Array.prototype.slice;
query.slice = function(a, i) {
    return slice.call(a, i);
}

// *************************************************************************************************

function Set(source, selector) {
    this.nodes = source || [];
    this.length = source ? source.length : 0;
    this.selector = selector || '';
}
query.Set = Set;

Set.prototype = fool.subclass(Bindable, {
    // Used internally
    assign: function(element) {
        this.nodes = unwrapSet(element);
        this.length = this.nodes.length;
        if (this.nodes.length == 1) {
            element.ore = this;
        }
    },
    
    init: function() {
        this.construct();
        this.ready = true;
    },

    construct: function() {
        // Meant to be overriden by subclasses
    },
      
    query: function(selector) {
        return query(selector, this);
    },
    
    each: function(callback) {
        return _.each(this.nodes, function(n) { return callback(wrap(n)); });
    },

    filter: function(callback) {
        return wrap(_.filter(this.nodes, function(n) { return callback(wrap(n)); }));
    },

    without: function(nodes) {
        return wrap(_.without(this.nodes, unwrapSet(nodes)));
    },

    union: function(nodes) {
        return wrap(_.union(this.nodes, unwrapSet(nodes)));
    },

    closest: function(selector) {
        var n = this.nodes[0], nodes = query(selector).nodes;
        while (n && nodes.indexOf(n) < 0) {
            n = n.parentNode;
        }
        return wrap(n && !(n === document) ? n : null);
    },

    contains: function(containedNode) {
        if (containedNode instanceof Set) {
            containedNode = containedNode.val();
        }
        for (var i = 0, l = this.nodes.length; i < l; ++i) {
            var node = this.nodes[i];
            while (node) {
                if (node == containedNode) {
                    return true;
                }
                node = node.parentNode;
            }
        }
        return false;
    },

    chain: function() {
        var chain = [];
        var n = this.nodes[0];
        while (n) {
            if (n.nodeType == 1) {
                chain.push(n);
            }
            n = n.parentNode;
        }
        return wrapSet(chain);
    },

    parent: function() {
        var parents = [];
       _.each(this.nodes, function(n) {
            parents.push(n.parentNode);
        });
        return wrapSet(parents);
    },
    
    first: function() {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.firstChild);
        });
        return wrapSet(children);
    },
    
    last: function() {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.lastChild);
        });
        return wrapSet(children);
    },
    
    next: function() {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.nextSibling);
        });
        return wrapSet(children);
    },
    
    previous: function() {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.previousSibling);
        });
        return wrapSet(children);
    },
    
    child: function(index) {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.childNodes[index]);
        });
        return wrapSet(children);
    },

    clone: function(deep) {
        var clones = [];
       _.each(this.nodes, function(n) {
            clones.push(n.cloneNode(deep));
        });
        return wrapSet(clones);
    },
    
    addClass: function(name) {
       _.each(this.nodes, function(n) {
            n.classList.add(name);
        });
        return this;
    },

    removeClass: function(name) {
       _.each(this.nodes, function(n) {
            n.classList.remove(name);
        });
        return this;
    },

    hasClass: function(name) {
        if (this.length) {
            return classRE(name).test(this.nodes[0].className);            
        }
    },
    
    get: function(index) {
        return wrap(this.nodes[index]);
    },

    append: function(target) {
        var slot = this.slots()[0];
        act(target, function action(n) { slot.appendChild(n); });
        return this;
    },

    appendTo: function(target) {
        wrap(target).append(this);
        return this;
    },

    prepend: function(target) {
        var slot = this.slots()[0];
        var first = wrap(slot).first();
        if (first.length) {
            first = first.nodes[0];
            act(target, function action(n) { slot.insertBefore(n, first); });
        } else {
            act(target, function action(n) { slot.appendChild(n); });            
        }
        return this;
    },

    before: function(insertNode, beforeNode) {
        if (beforeNode) {
            var first = this.slots()[0];
            act(insertNode, function action(n) {
                var c = unwrap(beforeNode);
                if (c) {
                    first.insertBefore(n, c);
                } else {
                    first.appendChild(n);
                }
            });
        } else {
            this.prepend(insertNode);
        }
        return this;
    },

    after: function(insertNode, afterNode) {
        if (afterNode && unwrap(afterNode).nextSibling) {
            var first = this.slots()[0];
            act(insertNode, function action(n) { first.insertBefore(n, unwrap(afterNode).nextSibling); });
        } else {
            this.append(insertNode);
        }
        return this;
    },

    replaceWith: function(replaceNode) {
        var first = this.slots()[0];
        act(replaceNode, function action(n) { first.parentNode.replaceChild(n, first); });
        return this;
    },

    remove: function() {
       _.each(this.nodes, function(n) {
            if (n.parentNode) {
                n.parentNode.removeChild(n);
            }
        });
        return this;
    },

    empty: function() {
        _.each(this.slots(), function(n) {
             n.innerHTML = '';
         });
        return this;
    },

    slots: function() {
        return _.map(this.nodes, function(n) { return n.__slot__ ? n.__slot__ : n; });
    },
    
    val: function() {
        return this.nodes.length ? this.nodes[0] : null;
    },

    html: function(value) {
        if (value === undefined) {
            return this.nodes[0].innerHTML;
        } else {
            _.each(this.nodes, function(n) {
                n.innerHTML = value;
            });
            return this;
        }
    },

    text: function(value) {
        if (value === undefined) {
            return this.nodes[0].innerText;
        } else {
           _.each(this.nodes, function(n) {
                n.innerText = value;
            });
            return this;
        }
    },
    
    attr: function(name, value) {
        if (value === undefined) {
            return this.nodes[0].getAttribute(name);
        } else {
           _.each(this.nodes, function(n) {
                n.setAttribute(name, value);
            });
            return this;
        }
    },

    prop: function(name, value) {
        if (value === undefined) {
            return this.nodes[0][name];
        } else {
           _.each(this.nodes, function(n) {
                n[name] = value;
            });
            return this;
        }
    },
    
    css: function(name, value) {
        if (value === undefined) {
            return this.nodes.length ? this.nodes[0].style[toCamelCase(name)] : undefined;
        } else if (this.nodes.length) {
            if (typeof value === "number" && !cssNumber[name]) {
                value += "px";
            }
           _.each(this.nodes, function(n) {
                if (!value) {
                    n.style.removeProperty(name);
                } else {
                    n.style[toCamelCase(name)] = value;
                }
            });
        }
        return this;
    },
    
    style: function(name, value) {
        if (value === undefined) {
            return this.nodes.length ? getComputedStyle(this.nodes[0])[toCamelCase(name)] : undefined;
        } else if (this.nodes.length) {
            return this.css(name, value);
        }
        return this;
    },
    
    scrollTop: function(val) {
        if (val === undefined) {
            return this.nodes[0].scrollTop;
        } else {
           _.each(this.nodes, function(n) {
                n.scrollTop = val;
            });
            return this;
        }
    },
    
    scrollLeft: function(val) {
        if (val === undefined) {
            return this.nodes[0].scrollLeft;
        } else {
           _.each(this.nodes, function(n) {
                n.scrollLeft = val;
            });
            return this;
        }
    },

    scrollWidth: function() {
        return this.nodes[0].scrollWidth;
    },
    
    scrollHeight: function() {
        return this.nodes[0].scrollHeight;
    },

    flex: function(flex) {
        if (flex === undefined) {
            return parseFloat(this.style('-webkit-flex'));
        } else {
            this.css('-webkit-flex', flex);
            return this;
        }
    },

    orient: function(orient) {
        if (orient === undefined) {
            return this.style('-webkit-flex-direction');
        } else {
            this.css('-webkit-flex-direction', orient);
            return this;
        }
    },
    
    width: function() {
        return this.nodes.length ? this.nodes[0].offsetWidth : 0;
    },

    height: function() {
        return this.nodes.length ? this.nodes[0].offsetHeight : 0;
    },

    contentWidth: function() {
        return this.nodes.length ? this.nodes[0].clientWidth : 0;
    },

    contentHeight: function() {
        return this.nodes.length ? this.nodes[0].clientHeight : 0;
    },

    offset: function() {
        var rect = this.nodes[0].getBoundingClientRect();
        return {
             left: rect.left + document.body.scrollLeft,
             top: rect.top + document.body.scrollTop,
             width: rect.width,
             height: rect.height
         };
    },
    
    position: function() {
        var first = this.nodes[0];
        return {
            left: first.offsetLeft,
            top: first.offsetTop,
            width: first.offsetWidth,
            height: first.offsetHeight
        };
    },
    
    listen: function(name, fn, capture) {
       _.each(this.nodes, function(n) {
            var node = query(n);
            var e = node[name];
            if (e == events.event) {
                e = node[name] = e.create();
            }
            if (e && e.addListener) {
                e.addListener(fn);
            } else if (has("dom-addeventlistener")) {
                n.addEventListener(name, fn, capture);
            } else if (n.attachEvent) {
                n.attachEvent(name, fn);
            }
        });
        return this;
    },
    
    unlisten: function(name, fn, capture) {
       _.each(this.nodes, function(n) {
            if (has("dom-addeventlistener")) {
                n.removeEventListener(name, fn, capture);
            } else if (n.detachEvent) {
                n.detachEvent(name, fn);
            }
        });
        return this;
    }
});

// *************************************************************************************************

function classRE(name) {
    return new RegExp("(^|\\s)"+name+"(\\s|$)");
}

function wrap(node) {
    if (!node) {
        return new Set([]);
    } else if (node.ore) {
        return node.ore;
    } else if (node.nodes) {
        return node;
    } else if (node instanceof Array) {
        return new Set(unwrapArray(node));
    } else {
        return new Set([node]);
    }
}

function unwrap(node) {
    if (node instanceof Set) {
        return node.nodes[0];
    } else {
        return node;
    }
}

function unwrapSet(node) {
    if (node instanceof Set) {
        return node.nodes;
    } else if (node instanceof Array) {
        return node;
    } else if (node) {
        return [node];
    } else {
        return [];
    }
}

function unwrapArray(nodes) {
    for (var i = 0, l = nodes.length; i < l; ++i) {
        nodes[i] = unwrap(nodes[i]);
    }
    return nodes;
}

function act(target, action) {
    if (target instanceof Set) {
       _.each(target.nodes, action);
    } else if (target.tag) {
        action((new target()).val());
    }  else {
        action(target);
    }
}

function wrapSet(nodes) {
    if (nodes.length == 1) {
        return wrap(nodes[0]);
    } else {
        return new Set(nodes);
    }
}

function toCamelCase(text) {
    return text.replace(/-+(.)?/g, function(match, chr) {
        return chr ? chr.toUpperCase() : '';
    });
}
