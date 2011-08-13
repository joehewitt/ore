/* See license.txt for terms of usage */
/* Based on http://documentcloud.github.com/underscore/ */

has("array-isarray");
has("dom-nodelist-sliceable");

var breaker = {};
var slice = Array.prototype.slice;
var isArray = Array.isArray;

function each(a, cb) {
    if (a) {
        if (a.forEach) {
            a.forEach(cb);
        } else if (isArray(a)) {
            for (var i = 0; i < a.length; ++i) {
                if (cb(a[i], i, a) === breaker) return;
            }
        } else {
            for (var k in a) {
                if (cb(a[k], k, a) === breaker) return;
            }
        }
    }
}

function map(a, cb) {
    var b = [];
    each(a, function(v, i) {
        b.push(cb(v, i, a));
    });
    return b;
}

function detect(a, cb) {
    var result;
    each(a, function(v, i) {
        if (cb(v, i, a)) {
            result = v;
            return breaker;
        }
    });
    return result;
}

function extend(a, b) {
    for (var k in b) {
        // Thanks to John Resig for this code
        // http://ejohn.org/blog/javascript-getters-and-setters/
        if (has("object-__proto__")) {
            var g = b.__lookupGetter__(k), s = b.__lookupSetter__(k);
            if (g || s) {
                if (g) a.__defineGetter__(k, g);
                if (g) a.__defineGetter__(k, g);
            } else if (b.hasOwnProperty(k)) {
                a[k] = b[k];
            }
        } else {
            a[k] = b[k];
        }
    }
    return a;
}

function subclass(a, b) {
    function f() {}
    if (a) {
        f.prototype = a.prototype;
    }
    return extend(new f(), b);
}

function clone(a) {
    return a ? (isArray(a) ? a.slice() : extend({}, a)) : a;
}

function keys(a) {
    var b = [];
    for (var k in a) b[b.length] = k;
    return b;
}

function values(a) {
    var b = [];
    for (var k in a) b[b.length] = a[k];
    return b;
}
  
function bind(fn, a) {
    var args = slice.call(arguments, 2);
    return function() {
        return fn.apply(a || {}, args.concat(slice.call(arguments)));
    };
}

function _slice(a, i) {
    return slice.call(a, i);
}

exports.each = each;
exports.map = map;
exports.detect = detect;
exports.extend = extend;
exports.subclass = subclass;
exports.keys = keys;
exports.values = values;
exports.slice = _slice;
exports.clone = clone;
exports.bind = bind;
exports.isArray = isArray;
