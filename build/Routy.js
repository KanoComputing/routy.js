(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
window.Routy = require('./index');
},{"./index":2}],2:[function(require,module,exports){
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

    if (href) {
        return href.replace(location.origin, '');
    }

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
        return this._loc || location.pathname;
    } else {
        return location.hash.slice(1);
    }
};

module.exports = {
    Router : Router,
    Route  : Route
};
},{"route-pattern":6,"tiny-emitter":7}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],5:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":3,"./encode":4}],6:[function(require,module,exports){
var querystring = require("querystring");

// # Utility functions
//
// ## Shallow merge two or more objects, e.g.
// merge({a: 1, b: 2}, {a: 2}, {a: 3}) => {a: 3, b: 2}
function merge() {
  return [].slice.call(arguments).reduce(function (merged, source) {
    for (var prop in source) {
      merged[prop] = source[prop];
    }
    return merged;
  }, {});
}

// Split a location string into different parts, e.g.:
// splitLocation("/foo/bar?fruit=apple#some-hash") => {
//  path: "/foo/bar", queryString: "fruit=apple", hash: "some-hash" 
// }
function splitLocation(location) {
  var re = /([^\?#]*)?(\?[^#]*)?(#.*)?$/;
  var match = re.exec(location);
  return {
    path: match[1] || '',
    queryString: match[2] && match[2].substring(1) || '',
    hash: match[3] && match[3].substring(1) || ''
  }
}

// # QueryStringPattern
// The QueryStringPattern holds a compiled version of the query string part of a route string, i.e.
// ?foo=:foo&fruit=:fruit
var QueryStringPattern = (function () {

  // The RoutePattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function QueryStringPattern(options) {

    // The query parameters specified
    this.params = options.params;

    // if allowWildcards is set to true, unmatched query parameters will be ignored
    this.allowWildcards = options.allowWildcards;

    // The original route string (optional)
    this.routeString = options.routeString;
  }

  QueryStringPattern.prototype.matches = function (queryString) {
    var givenParams = (queryString || '').split("&").reduce(function (params, pair) {
      var parts = pair.split("="),
        name = parts[0],
        value = parts[1];
      if (name) params[name] = value;
      return params;
    }, {});

    var requiredParam, requiredParams = [].concat(this.params);
    while (requiredParam = requiredParams.shift()) {
      if (!givenParams.hasOwnProperty(requiredParam.key)) return false;
      if (requiredParam.value && givenParams[requiredParam.key] != requiredParam.value) return false;
    }
    if (!this.allowWildcards && this.params.length) {
      if (Object.getOwnPropertyNames(givenParams).length > this.params.length) return false;
    }
    return true;
  };

  QueryStringPattern.prototype.match = function (queryString) {

    if (!this.matches(queryString)) return null;

    var data = {
      params: [],
      namedParams: {},
      namedQueryParams: {}
    };

    if (!queryString) {
      return data;
    }

    // Create a mapping from each key in params to their named param
    var namedParams = this.params.reduce(function (names, param) {
      names[param.key] = param.name;
      return names;
    }, {});

    var parsedQueryString = querystring.parse(queryString);
    Object.keys(parsedQueryString).forEach(function(key) {
      var value = parsedQueryString[key];
      data.params.push(value);
      if (namedParams[key]) {
        data.namedQueryParams[namedParams[key]] = data.namedParams[namedParams[key]] = value;
      }
    });
    return data;
  };

  QueryStringPattern.fromString = function (routeString) {

    var options = {
      routeString: routeString,
      allowWildcards: false,
      params: []
    };

    // Extract named parameters from the route string
    // Construct an array with some metadata about each of the named parameters
    routeString.split("&").forEach(function (pair) {
      if (!pair) return;

      var parts = pair.split("="),
        name = parts[0],
        value = parts[1] || '';

      var wildcard = false;

      var param = { key: name };

      // Named parameters starts with ":"
      if (value.charAt(0) == ':') {
        // Thus the name of the parameter is whatever comes after ":"
        param.name = value.substring(1);
      }
      else if (name == '*' && value == '') {
        // If current param is a wildcard parameter, the options are flagged as accepting wildcards
        // and the current parameter is not added to the options' list of params
        wildcard = options.allowWildcards = true;
      }
      else {
        // The value is an exact match, i.e. the route string 
        // page=search&q=:query will match only when the page parameter is "search"
        param.value = value;
      }
      if (!wildcard) {
        options.params.push(param);
      }
    });
    return new QueryStringPattern(options);
  };

  return QueryStringPattern;
})();

// # PathPattern
// The PathPattern holds a compiled version of the path part of a route string, i.e.
// /some/:dir
var PathPattern = (function () {

  // These are the regexps used to construct a regular expression from a route pattern string
  // Based on route patterns in Backbone.js
  var
    pathParam = /:\w+/g,
    splatParam = /\*\w+/g,
    namedParams = /(:[^\/\.]+)|(\*\w+)/g,
    subPath = /\*/g,
    escapeRegExp = /[-[\]{}()+?.,\\^$|#\s]/g;

  // The PathPattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function PathPattern(options) {
    // The route string are compiled to a regexp (if it isn't already)
    this.regexp = options.regexp;

    // The query parameters specified in the path part of the route
    this.params = options.params;

    // The original routestring (optional)
    this.routeString = options.routeString;
  }

  PathPattern.prototype.matches = function (pathname) {
    return this.regexp.test(pathname);
  };

  // Extracts all matched parameters
  PathPattern.prototype.match = function (pathname) {

    if (!this.matches(pathname)) return null;
    
    // The captured data from pathname
    var data = {
      params: [],
      namedParams: {}
    };

    // Using a regexp to capture named parameters on the pathname (the order of the parameters is significant)
    (this.regexp.exec(pathname) || []).slice(1).forEach(function (value, idx) {
      if(value !== undefined) {
        value = decodeURIComponent(value);
      }

      data.namedParams[this.params[idx]] = value;
      data.params.push(value);
    }, this);

    return data;
  };

  PathPattern.routePathToRegexp = function (path) {
    path = path
      .replace(escapeRegExp, "\\$&")
      .replace(pathParam, "([^/]+)")
      .replace(splatParam, "(.*)?")
      .replace(subPath, ".*?")
      .replace(/\/?$/, "/?");
    return new RegExp("^/?" + path + "$");
  };

  // This compiles a route string into a set of options which a new PathPattern is created with 
  PathPattern.fromString = function (routeString) {

    // Whatever comes after ? and # is ignored
    routeString = routeString.split(/\?|#/)[0];

    // Create the options object
    // Keep the original routeString and a create a regexp for the pathname part of the url
    var options = {
      routeString: routeString,
      regexp: PathPattern.routePathToRegexp(routeString),
      params: (routeString.match(namedParams) || []).map(function (param) {
        return param.substring(1);
      })
    };

    // Options object are created, now instantiate the PathPattern
    return new PathPattern(options);
  };

  return PathPattern;
}());

// # RegExpPattern
// The RegExpPattern is just a simple wrapper around a regex, used to provide a similar api as the other route patterns
var RegExpPattern = (function () {
  // The RegExpPattern constructor
  // Wraps a regexp and provides a *Pattern api for it
  function RegExpPattern(regex) {
    this.regex = regex;
  }

  RegExpPattern.prototype.matches = function (loc) {
    return this.regex.test(loc);
  };

  // Extracts all matched parameters
  RegExpPattern.prototype.match = function (location) {

    if (!this.matches(location)) return null;

    var loc = splitLocation(location);

    return {
      params: this.regex.exec(location).slice(1),
      queryParams: querystring.parse(loc.queryString),
      namedParams: {}
    };
  };

  return RegExpPattern;
}());

// # RoutePattern
// The RoutePattern combines the PathPattern and the QueryStringPattern so it can represent a full location
// (excluding the scheme + domain part)
// It also allows for having path-like routes in the hash part of the location
// Allows for route strings like:
// /some/:page?param=:param&foo=:foo#:bookmark
// /some/:page?param=:param&foo=:foo#/:section/:bookmark
// 
// Todo: maybe allow for parameterization of the kind of route pattern to use for the hash?
// Maybe use the QueryStringPattern for cases like
// /some/:page?param=:param&foo=:foo#?onlyCareAbout=:thisPartOfTheHash&*
// Need to test how browsers handles urls like that
var RoutePattern = (function () {

  // The RoutePattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function RoutePattern(options) {
    // The route string are compiled to a regexp (if it isn't already)
    this.pathPattern = options.pathPattern;
    this.queryStringPattern = options.queryStringPattern;
    this.hashPattern = options.hashPattern;

    // The original routestring (optional)
    this.routeString = options.routeString;
  }

  RoutePattern.prototype.matches = function (location) {
    // Whatever comes after ? and # is ignored
    var loc = splitLocation(location);

    return (!this.pathPattern || this.pathPattern.matches(loc.path)) &&
      (!this.queryStringPattern || this.queryStringPattern.matches(loc.queryString) ) &&
      (!this.hashPattern || this.hashPattern.matches(loc.hash))
  };

  // Extracts all matched parameters
  RoutePattern.prototype.match = function (location) {

    if (!this.matches(location)) return null;

    // Whatever comes after ? and # is ignored
    var loc = splitLocation(location),
      match,
      pattern;

    var data = {
      params: [],
      namedParams: {},
      pathParams: {},
      queryParams: querystring.parse(loc.queryString),
      namedQueryParams: {},
      hashParams: {}
    };

    var addMatch = function (match) {
      data.params = data.params.concat(match.params);
      data.namedParams = merge(data.namedParams, match.namedParams);
    };

    if (pattern = this.pathPattern) {
      match = pattern.match(loc.path);
      if (match) addMatch(match);
      data.pathParams = match ? match.namedParams : {};
    }
    if (pattern = this.queryStringPattern) {
      match = pattern.match(loc.queryString);
      if (match) addMatch(match);
      data.namedQueryParams = match ? match.namedQueryParams : {};
    }
    if (pattern = this.hashPattern) {
      match = pattern.match(loc.hash);
      if (match) addMatch(match);
      data.hashParams = match ? match.namedParams : {};
    }
    return data;
  };

  // This compiles a route string into a set of options which a new RoutePattern is created with 
  RoutePattern.fromString = function (routeString) {
    var parts = splitLocation(routeString);

    var matchPath = parts.path;
    var matchQueryString = parts.queryString || routeString.indexOf("?") > -1;
    var matchHash = parts.hash || routeString.indexOf("#") > -1;

    // Options object are created, now instantiate the RoutePattern
    return new RoutePattern({
      pathPattern: matchPath && PathPattern.fromString(parts.path),
      queryStringPattern: matchQueryString && QueryStringPattern.fromString(parts.queryString),
      hashPattern: matchHash && PathPattern.fromString(parts.hash),
      routeString: routeString
    });
  };

  return RoutePattern;
}());

// CommonJS export
module.exports = RoutePattern;

// Also export the individual pattern classes
RoutePattern.QueryStringPattern = QueryStringPattern;
RoutePattern.PathPattern = PathPattern;
RoutePattern.RegExpPattern = RegExpPattern;

},{"querystring":5}],7:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}]},{},[1]);
