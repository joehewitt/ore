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

var windowSet;
var documentSet;
var emptySet;

var rootDocument = window.document;
var rootNode = rootDocument;

function query(selector, context, findOne) {
    if (selector === 'body') {
        return wrap(rootDocument.body);
    } else if (typeof selector === 'string') {
        if (!context && /^#([\w\-]+)$/.exec(selector)) {
            // Shortcut for getting element by id
            return wrap(rootNode.getElementById(selector.substr(1)));
        } else {
            var node = context ? unwrap(context) : rootNode;
            if (findOne) {
                return wrap(node.querySelector
                    ? node.querySelector(selector)
                    : rootNode.querySelector.call(node, selector));
            } else {
                return wrapSet(query.slice(node.querySelectorAll
                    ? node.querySelectorAll(selector)
                    : rootNode.querySelectorAll.call(node, selector)), 0);
            }
        }
    } else {
        return wrap(selector);
    }
}

query.setRoot = function(node) {
    rootNode = node;
    rootDocument = node.ownerDocument;
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
      
    query: function(selector, findOne) {
        return query(selector, this, findOne);
    },
    
    equals: function(otherSet) {
        if (this.length == otherSet.length) {
            var nodes = this.nodes;
            var others = otherSet.nodes;
            for (var i = 0, l = nodes.length; i < l; ++i) {
                if (nodes[i] != others[i]) {
                    return false;
                }
            }
            return true;
        }
        return false;
    },

    each: function(callback) {
        return _.each(this.nodes, function(n) { return callback(wrap(n)); });
    },

    find: function(callback) {
        return _.find(this.nodes, function(n) { return callback(wrap(n)); });
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
        return wrap(n && !(n === rootNode) ? n : null);
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
       _.each(this.nodes, function(n) {
            children.push(n.nextSibling);
        });
        return wrapSet(children);
    },
    
    previous: function() {
        var children = [];
       _.each(this.nodes, function(n) {
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

    cssClass: function(name, value) {
        if (value === undefined) {
           for (var i = 0, l = this.nodes.length; i < l; ++i) {
                var n = this.nodes[i];
                if (n.classList.contains(name)) {
                    return true;
                }
            }
        } else {
           _.each(this.nodes, function(n) {
                if (value && !n.classList.contains(name)) {
                    n.classList.add(name);
                } else if (!value && n.classList.contains(name)) {
                    n.classList.remove(name);
                }
            });
            return this;
        }
    },
    
    get: function(index) {
        return wrap(this.nodes[index]);
    },

    append: function(target, ignoreSlots) {
        var slot = ignoreSlots ? this.nodes[0] : this.slots()[0];
        if (slot) {
            act(target, function action(n) { slot.appendChild(n); });
        }
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
        act(replaceNode, function action(n) {
            first.parentNode.replaceChild(n, first);
        });
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
            return this.slots()[0].innerHTML;
        } else {
            _.each(this.slots(), function(n) {
                n.innerHTML = value;
            });
            return this;
        }
    },

    text: function(value) {
        if (value === undefined) {
            return this.slots()[0].innerText;
        } else {
            _.each(this.slots(), function(n) {
                n.innerText = value;
            });
            return this;
        }
    },
    
    attr: function(name, value) {
        if (value === undefined) {
            var n = this.nodes[0];
            return n && n.nodeType == 1 ? n.getAttribute(name) : null;
        } else if (value === null) {
           _.each(this.nodes, function(n) {
                n.removeAttribute(name);
            });
        } else {
           _.each(this.nodes, function(n) {
                n.setAttribute(name, value);
            });
        }
        return this;
    },

    prop: function(name, value) {
        if (value === undefined) {
            var n = this.nodes[0];
            return n ? n[name] : null;
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

    focus: function() {
        return this.val().focus();
    },
    
    scrollTop: function(val) {
        if (val === undefined) {
            var n = this.nodes[0];
            return n ? n.scrollTop : null;
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
        var first = this.nodes[0];
        if (first) {
            var rect = first.getBoundingClientRect();
            return {
                 left: rect.left + rootDocument.body.scrollLeft,
                 top: rect.top + rootDocument.body.scrollTop,
                 width: rect.width,
                 height: rect.height
             };
        } else {
            return {};
        }
    },
    
    position: function() {
        var first = this.nodes[0];
        if (first) {
            return {
                left: first.offsetLeft,
                top: first.offsetTop,
                width: first.offsetWidth,
                height: first.offsetHeight
            };
        } else {
            return {};
        }
    },
    
    listen: function(name, fn, capture) {
       _.each(this.nodes, function(n) {
            var node = wrap(n);
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
    },

    cmd: function(cmd, commandName) {
        if (cmd === undefined) {
           var commands = _.map(this.nodes, function(n) {
                n = wrap(n);
                if (n.command) {
                    return n.command;
                }

                var commandId = commandName || n.attr('command');
                if (commandId) {
                    for (; n.length; n = n.parent()) {
                        var commands = n.commands;
                        if (commands) {
                            var command = commands.find(commandId);
                            if (command) {
                                return command;
                            }
                        }
                    }
                }
            });
           return commands.length > 1 ? commands : commands[0];
        } else {
            this.each(function(n) {
                if (typeof(cmd) == 'string') {
                    n.attr('command', cmd);
                } else {
                    n.command = cmd;
                }
            });
        }
    },

    validateCondition: function(conditionId, subtree) {
        if (!subtree) {
            subtree = this;
        }
        var commands = this.commands;
        if (commands) {
            var condition = commands.conditionMap[conditionId];
            var conditionFn = condition.validate;
            var truth = conditionFn ? conditionFn() : false;

            var commands = condition.commands;
            for (var i = 0, l = commands.length; i < l; ++i) {
                var command = commands[i];
                subtree.query('*[command=' + command.id + ']').each(function(target) {
                    target.cssClass('disabled', !truth);
                });
            }
            return truth;
        }
    },

    validateConditions: function(subtree) {
        var commands = this.commands;
        if (commands) {
            if (!subtree) {
                subtree = this;
            }
            for (var conditionId in commands.conditionMap) {
                this.validateCondition(conditionId, subtree);
            }
        }
    }
});

// *************************************************************************************************

function wrap(node) {
    if (!node) {
        if (!emptySet) {
            return emptySet = new Set([]);
        } else {
            return emptySet;            
        }
    } else if (node.ore) {
        return node.ore;
    } else if (node.nodes) {
        return node;
    } else if (node instanceof Array) {
        if (!node.length) {
            return wrap(null);
        } else {
            return new Set(unwrapArray(node));            
        }
    } else if (node == window) {
        if (!windowSet) {
            return windowSet = new Set([node]);
        } else {
            return windowSet;
        }        
    } else if (node == document) {
        if (!documentSet) {
            return documentSet = new Set([node]);
        } else {
            return documentSet;
        }        
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
        return wrap(nodes);
    }
}

function toCamelCase(text) {
    return text.replace(/-+(.)?/g, function(match, chr) {
        return chr ? chr.toUpperCase() : '';
    });
}
