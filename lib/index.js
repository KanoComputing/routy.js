var RoutePattern = require('route-pattern'),
    EventEmitter = require('tiny-emitter');

//
// Route class (Initialised by Router instances)
//

function Route () {
    this.pattern = RoutePattern.fromString(arguments[0]);
    this.options = {};

    for (var i = 1; i < arguments.length; i += 1) {
        if (typeof arguments[i] === 'object') {
            this.options = arguments[i];
        } else if (typeof arguments[i] === 'function') {
            this.fn = arguments[i];
        }
    }
}

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
}

//
// Extends prototype from EventEmitter
//

Router.prototype = new EventEmitter();

//
// Add a new root
//

Router.prototype.add = function (pattern, fn, options) {
    this.routes.push(new Route(pattern, fn, options));
    return this;
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
    var self = this;

    this.refresh();

    this.hashListener = function () {
        self.refresh();
    };

    window.addEventListener('hashchange', this.hashListener);
    return this;
};

//
// Stop listening to hash changes
//

Router.prototype.stop = function () {
    window.removeEventListener('hashchange', this.hashListener);
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

Router.prototype.goTo = function (path) {
    window.location.replace('#' + path);
    this.refresh();
};

//
// Parse the path, find the matching route and change if found
//

Router.prototype.refresh = function () {
    var path = location.hash.slice(1),
        route = this.getRouteByPath(path),
        evt;

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

        this.cancel = false;
        this.redirect = null;

        if (this.cancel) {
            return;
        } else if (redirect) {
            this.goTo(redirect);
            return;
        }
    }

    this.path = path;
    this.setRoute(route, evt);
};

module.exports = {
    Router: Router,
    Route: Route
};