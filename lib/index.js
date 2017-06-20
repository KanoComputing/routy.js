var RoutePattern = require('route-pattern'),
    EventEmitter = require('tiny-emitter');

var EXCLUDE_PATTERN = /(^(?!http|\/\/|::|[a-z]*:)(.*)$)/;

//
// Route class (Initialised by Router instances)
//

function Route (pattern, base, fn, options) {
    this.pattern = RoutePattern.fromString(pattern);
    this.options = options || {};
    this.fn = fn;

    if (base) {
        this.extendFrom(base);
    }
}

//
// Extend funciton and options from given route instance
//

Route.prototype.extendFrom = function (route) {
    this.fn = this.fn || route.fn;

    for (var key in route.options) {
        if (route.options.hasOwnProperty(key)) {
            this.options[key] = this.options[key] || route.options[key];
        }
    }
};

//
// Router class (Use to initialise routes and listen to Hash changes)
//

function Router () {
    EventEmitter.apply(this);   // Call EventEmitter constructor

    this.routes = [];           // Array containing all routes
    this.path = '/';            // Current path (`/` is default)
    this.otherwise(this.path);  // Set default redirect
    this.cancel = false;        // Cancel next route change
    this.redirect = null;       // Redirect next route change

    this.recentReloads = 0;     // Number of reloads called in last 500ms
    this.resetTimer = null;     // Timeout set to clear recent reloads

    this.html5(false);          // Disable HTML5 mode by default
}

//
// Extends prototype from EventEmitter
//

Router.prototype = new EventEmitter();

//
// Add a new root
//

Router.prototype.add = function (pattern, fn, options) {
    var extendFrom;

    if (typeof fn === 'object') {
        var _fn = fn;
        fn = options;
        options = _fn;
    }

    if (options && options.extends) {
        extendFrom = this.getRouteById(options.extends);

        if (!extendFrom) {
            throw new Error('Routy: Extending from unexisting route "' + extendFrom + '"');
        }
    }

    var route = new Route(pattern, extendFrom, fn, options);

    this.routes.push(route);

    return this;
};

//
// Get a route by `id` field passed in `options
//

Router.prototype.getRouteById = function (id) {
    for (var i = 0; i < this.routes.length; i += 1) {
        if (this.routes[i].options.id === id) {
            return this.routes[i];
        }
    }

    return null;
};

//
// Set redirect path to use when trying to access a 'non-routed' path
//

Router.prototype.otherwise = function (path) {
    this.defaultPath = path;
    return this;
};

//
// Use when finish configuring, start listening to hash changes
//

Router.prototype.run = function () {
    var queryParts = location.href.split('?');

    this.query = queryParts.length > 1 ? queryParts[1] : null;

    this.refresh();

    if (this._html5) {
        this.html5(true);
    }

    this._changeListener = function () {
        if (this._preventChange) {
            this._preventChange = false;
            return;
        }

        this._loc = location.pathname;
        this.refresh();
    }.bind(this);

    window.addEventListener(this._changeEvent, this._changeListener);
    return this;
};

//
// Set HTML5 routes use
//

Router.prototype.html5 = function (state) {
    this._html5 = typeof state === 'undefined' || state === null || state ? true : false;

    if (this._html5) {
        this.bindLinks();
        this._changeEvent = 'popstate';
    } else {
        this.unBindLinks();
        this._changeEvent = 'hashchange';
    }

    return this;
};

//
// Delegate link click (Used in html5 mode)
//

Router.prototype.bindLinks = function () {
    if (this._clickListener) {
        return;
    }

    this._clickListener = function (e) {
        var href = getHrefRec(e.target),
            blankTarget = e.target.getAttribute('target') === '_blank',
            specialKey = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

        if (href && EXCLUDE_PATTERN.test(href) && !blankTarget && !specialKey) {
            e.preventDefault();

            this.goTo(href, true);

            if (href.indexOf('#') !== -1) {
                this._preventChange = true;
                window.location.hash = href.substr(href.indexOf('#') + 1);
            }
        }
    }.bind(this);

    window.addEventListener('click', this._clickListener);
};

//
// Search recursively href attribute value between given element and parents
//

function getHrefRec(element) {
    var href = element.getAttribute('href');

    if (href) { return href; }

    if (element.parentElement && element.parentElement !== document.body) {
        return getHrefRec(element.parentElement);
    }

    return null;
}

//
// Remove link click delegation if set
//

Router.prototype.unBindLinks = function () {
    if (this._clickListener) {
        removeEventListener('click', this._clickListener);
        this._clickListener = null;
    }
};

//
// Stop listening to hash changes
//

Router.prototype.stop = function () {
    window.removeEventListener(this._changeEvent, this._changeListener);
    this.unBindLinks();

    return this;
};

//
// Get the route corresponding to a given path by matching expressions
//

Router.prototype.getRouteByPath = function (path) {
    for (var i = 0; i < this.routes.length; i += 1) {
        if (this.routes[i].pattern.matches(path)) {
            return this.routes[i];
        }
    }

    return null;
};

//
// Called when changing route, calls Route function and emits the 'change'
//

Router.prototype.setRoute = function (route, evt) {
    this.route = route;

    if (this.route.fn) {
        this.route.fn.call(this, evt);
    }

    this.emit('change', evt, this);
};

//
// Redirect to a given path
//

Router.prototype.goTo = function (path, push) {
    var query = path.split('?')[1] || null;

    if (this._html5) {
        this._loc = path;
    } else {
        window.location.replace('#' + path);
    }

    this.query = query;

    this.recentReloads += 1;

    if (this.resetTimer) {
        clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(function () {
        this.recentReloads = 0;
    }.bind(this), 500);

    if (this.recentReloads > 10) {
        this.stop();
        throw new Error('Routy: Too many redirects. Stopping..');
    }

    this.refresh(push);
};

//
// Parse the path, find the matching route and change if found
//

Router.prototype.refresh = function (push) {
    var path = this.getPath(),
        route = this.getRouteByPath(path),
        evt;

    path = path ? path.split('?')[0] : null;

    if (this.query) {
        path += '?' + this.query;
    }

    if (!route) {
        this.goTo(this.defaultPath);
        return;
    }

    evt = route.pattern.match(path);
    evt.path = path;
    evt.route = route;

    this.emit('beforeChange', evt, this);

    if (this.cancel || this.redirect) {
        var redirect = this.redirect;

        this.redirect = null;

        if (this.cancel) {
            this.cancel = false;
            return;
        } else if (redirect) {
            this.goTo(redirect);
            return;
        }
    }

    if (this._html5) {
        var method = push ? 'pushState' : 'replaceState';

        window.history[method]({}, null, path);
    }

    this.path = path;
    this.setRoute(route, evt);
};

Router.prototype.getPath = function () {
    if (this._html5) {
        var path = this._loc || location.pathname;
        var hashLoc = location.hash.split('#').slice(1).join('#');
        return path + (hashLoc ? '#' + hashLoc : '');
    } else {
        return location.hash.slice(1);
    }
};

module.exports = {
    Router : Router,
    Route  : Route
};