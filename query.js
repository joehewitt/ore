/* See license.txt for terms of usage */

has("string-trim");
// has("dom-queryselector");
has("dom-addeventlistener");

var _ = require('./iter');

var cssNumber = {
    zIndex: true,
    fontWeight: true,
    opacity: true,
    zoom: true,
    lineHeight: true
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
            return wrapSet(_.slice(node.querySelectorAll
                ? node.querySelectorAll(selector)
                : document.querySelectorAll.call(node, selector)));
        }
    } else {
        return wrap(selector);
    }
}

module.exports = query;

// *************************************************************************************************

function Set(source, selector) {
    this.nodes = source || [];
    this.length = source ? source.length : 0;
    this.selector = selector || '';
}
query.Set = Set;

Set.prototype = {
    // Used internally
    assign: function(element) {
        this.nodes = unwrapSet(element);
        this.length = this.nodes.length;
        if (this.nodes.length == 1) {
            element.ore = this;
        }
        this.construct();
    },
      
    query: function(selector) {
        return query(selector, this);
    },
    
    construct: function() {
        // Meant to be overriden by subclasses
    },
      
    each: function(callback) {
        return _.each(this.nodes, function(n) { return callback(wrap(n)); });
    },

    closest: function(selector) {
        var n = this.nodes[0], nodes = query(selector).nodes;
        while (n && nodes.indexOf(n) < 0) {
            n = n.parentNode;
        }
        return wrap(n && !(n === document) ? n : null);
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
    
    child: function(index) {
        var children = [];
       _.each(this.slots(), function(n) {
            children.push(n.childNodes[index]);
        });
        return wrapSet(children);
    },
    
    addClass: function(name) {
       _.each(this.nodes, function(n) {
            !query(n).hasClass(name) && (n.className += (n.className ? ' ' : '') + name);
        });
        return this;
    },

    removeClass: function(name) {
       _.each(this.nodes, function(n) {
            n.className = n.className.replace(classRE(name), ' ').trim();
        });
        return this;
    },

    hasClass: function(name) {
        return classRE(name).test(this.nodes[0].className);
    },
    
    get: function(index) {
        return wrap(this.nodes[index]);
    },

    append: function(target) {
        var first = this.slots()[0];
        act(target, function action(n) { first.appendChild(n); });
        return this;
    },

    appendTo: function(target) {
        $(target).append(this);
        return this;
    },

    prepend: function(target) {
        var first = this.slots()[0];
        act(target, function action(n) { first.parentNode.insertBefore(n, first); });
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
        if (afterNode && afterNode.nextSibling) {
            var first = this.slots()[0];
            act(insertNode, function action(n) { first.insertBefore(n, unwrap(afterNode).nextSibling); });
        } else {
            this.append(insertNode);
        }
        return this;
    },

    remove: function() {
       _.each(this.nodes, function(n) {
            n.parentNode.removeChild(n);
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
        return this.nodes;
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
    
    width: function() {
        return this.nodes.length ? this.nodes[0].offsetWidth : 0;
    },

    height: function() {
        return this.nodes.length ? this.nodes[0].offsetHeight : 0;
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
            if (has("dom-addeventlistener")) {
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
};

// *************************************************************************************************

function classRE(name) {
    return new RegExp("(^|\\s)"+name+"(\\s|$)");
}

function wrap(node) {
    if (!node) {
        return new Set([]);
    } else if (node.ore) {
        return node.ore;
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
