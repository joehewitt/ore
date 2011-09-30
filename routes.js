/* See license.txt for terms of usage */

var D;

has("json-parse");

var $ = require('./query');

var routes = [];
var mainView = null;
var currentLocation;
var nextScroll;
var historyIndex;
var realScroll = 0;

if (has('native-sessionstorage')) {
    historyIndex = !sessionStorage.scrollIndex ? 0 : parseInt(sessionStorage.scrollIndex);
}

var REPLACE = "REPLACE";
var PUSH = "PUSH";
var BACK = "BACK";
var FORWARD = "FORWARD";

function add(pattern, callback) {
    routes[routes.length] = {pattern: new RegExp(pattern), callback: callback};
}

function remove(pattern) {
    // XXXjoe Implement me
}

function match(path) {
    for (var i = 0; i < routes.length; ++i) {
        var route = routes[i];
        var args = route.pattern.exec(path);
        if (args) {
            return {route: route, args: args};
        }
    }
}

function update(path, action, goToIndex, ignoreErrors) {
    var m = match(path);
    if (m) {
        D&&D(action);
        if (action == REPLACE) {
            pushScroll(true);
        } else if (action == PUSH) {
            pushScroll();
        } else if (action == BACK) {
            popScroll(false, goToIndex);
        } else if (action == FORWARD) {
            popScroll(true, goToIndex);
        } else {
            syncScroll();        
        }

        m.route.callback(m.args.slice(1), action == BACK);
    } else if (!ignoreErrors) {
        if (exports.errorHandler) {
            exports.errorHandler([404]);
        }
    }

    return !!m;
}

function push(creator) {
    if (mainView) {
        mainView.pushPage(creator);
    } else {
        $('body').empty().append(creator());
    }
}

function pop(creator) {
    if (mainView) {
        mainView.popPage(creator);
    } else {
        $('body').empty().append(creator());
    }
}

function setMainView(view) {
    mainView = view;
    $('body').empty().append(view);
}

require.ready(function() {
    if (has("native-history-state")) {
        $(window).listen('click', function(event) {
            if (event.button == 0 && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
                var link = $(event.target).closest('a');

                if (link.val() && link.prop('hostname') == window.location.hostname
                    && !link.prop('target')) {
                    if (link.attr('type') == 'action') {
                        event.preventDefault();
                        
                    } else if (link.attr('type') == 'replace') {
                        currentLocation = link.attr('href');
                        history.replaceState({referer: location.href, id: historyIndex}, '', currentLocation);
                        update(location.pathname, REPLACE);
                        event.preventDefault();
                    } else {
                        currentLocation = link.attr('href');
                        history.pushState({referer: location.href, id: historyIndex}, '', currentLocation);
                        if (update(location.pathname, PUSH, 0, true)) {
                            event.preventDefault();                    
                        }
                    }
                }
            }
        }, false);

        $(window).listen('unload', function(event) {
            pushScroll(true);
        });

        $(window).listen('scroll', function(event) {
            // I only to do this because Firefox restores scrollY when going back before the popstate
            // event fires, so I have no opportunity to save the current scrollY myself before it is
            // wiped out.  I think this is a "feature"
            realScroll = window.scrollY;
        });

        $(window).listen('popstate', function(event) {
            var referer = event.state ? event.state.referer : '';
            if (currentLocation != location.href) {
                var goToIndex;
                if (event.state) {
                    goToIndex = event.state.id+1;
                } else {
                    goToIndex = 0;
                }

                var action = !referer && !currentLocation ? null : referer != currentLocation ? BACK : FORWARD;
                update(location.pathname, action, goToIndex);
                currentLocation = location.href;
            }
        });
    }
    
    update(location.pathname);
    currentLocation = location.href;
});

function pushScroll(replace) {
    if (has('native-sessionstorage')) {
        var scrolls = sessionStorage.scroll ? JSON.parse(sessionStorage.scroll) : [];
        scrolls[historyIndex] = realScroll;
        if (!replace || !scrolls.length) {
            sessionStorage.scrollIndex = ++historyIndex;
            scrolls.splice(historyIndex, scrolls.length-historyIndex, 0);
        }
        sessionStorage.scroll = JSON.stringify(scrolls);
        D&&D('push', sessionStorage.scrollIndex, sessionStorage.scroll);
    }
}

function popScroll(forward, goToIndex) {
    if (has('native-sessionstorage')) {
        if (sessionStorage.scroll) {
            var scrolls = JSON.parse(sessionStorage.scroll);
            if (currentLocation) {
                scrolls[historyIndex] = realScroll;
            }
            if (goToIndex !== undefined) {
                historyIndex = goToIndex;
            } else if (forward) {
                ++historyIndex;
            } else {
                --historyIndex;
            }

            nextScroll = scrolls[historyIndex];
            sessionStorage.scroll = JSON.stringify(scrolls);
            sessionStorage.scrollIndex = historyIndex;
            D&&D('pop', sessionStorage.scrollIndex, sessionStorage.scroll);
        }
    }
}

function syncScroll() {
    if (has('native-sessionstorage')) {
        if (sessionStorage.scroll) {
            var scrolls = JSON.parse(sessionStorage.scroll);
            nextScroll = scrolls[historyIndex];
        }
    }
}

exports.finalize = function() {
    setTimeout(function() {
        if (nextScroll !== undefined) {
            window.scrollTo(0, nextScroll);
            nextScroll = undefined;
        }
    }, 0)
}

exports.add = add;
exports.match = match;
exports.push = push;
exports.pop = pop;
exports.update = update;
exports.setMainView = setMainView;

