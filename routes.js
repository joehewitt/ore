/* See license.txt for terms of usage */

var $ = require('./query');

var routes = [];
var mainView = null;
var currentLocation;

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

function update(href, base, isBack) {
    if (base.substr(base.length-1) == '/') {
        base = base.substr(0, base.length-1);
    }
    var path = href.substr(base.length);
    if (!path) {
        path = '/';
    }

    // XXXjoe No window.location.search on server
    if (window.location.search) {
        path = path.substr(0, path.length-window.location.search.length);
    }
    
    var m = match(path);
    if (m) {
        m.route.callback(m.args.slice(1), isBack);
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
    window.addEventListener('click', function(event) {
        var link = $(event.target).closest('a');

        if (link.val() && link.prop('hostname') == window.location.hostname) {

            event.preventDefault();
            if (link.attr('type') == 'action') {
                
            } else if (link.attr('type') == 'replace') {
                currentLocation = link.attr('href');
                history.replaceState({referrer: location.href}, '', currentLocation);
                update(location.href, document.baseURI);
            } else {
                currentLocation = link.attr('href');
                history.pushState({referrer: location.href}, '', currentLocation);
                update(location.href, document.baseURI);
            }
        }
    }, false);

    window.addEventListener('popstate', function(event) {
        var referrer = event.state ? event.state.referrer : '';
        if (referrer) {
            update(location.href, document.baseURI, referrer != currentLocation);
            currentLocation = location.href;
        }
    }, false);

    update(location.pathname, document.baseURI);    
});

exports.add = add;
exports.match = match;
exports.push = push;
exports.pop = pop;
exports.update = update;
exports.setMainView = setMainView;
