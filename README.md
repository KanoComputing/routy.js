# Routy.js

> A dead simple module to manage hash routing in the browser.

## Install

You can either use the module with npm

    `npm install routy`

Or include the file `build/Routy.js` in your HTML (which provides a wrapper at `window.Routy`)

## Examples of usage

### Simple usage with controller functions

Bind functions to hashbang routes, execute them by changing the hash location to `#/path`.

```javascript
var Router = Require('routy').Router;

var myRouter = new Router();

function index (route, req) {
    console.log(route); // The Route instance (containing path, custom options, ..)
    console.log(req);   // Will contained requested path, URL params, etc.. (If availabe, in different forms)
    console.log(this);  // The Router instance - also containing current `.path` and `.route`
}

function logParams (route, req) {
    console.log(req.namedParams);   // { apples: '..'}
}

function logOptions (route, req) {
    // Access route custom options. Boom!
    console.log(route.options);  // { someOption: 'wooah' }
}

myRouter
.add('/', index)
.add('/foo/:apples', logParams)
.add('/bar', logOptions, { someOption: 'wooah' })
.on('change', function (req, route) {
    console.log('Changing to path: ' + req.path);
});
```

### Simple templates example

`Routy.Router` instanciates as an event emitter.

Intercept the `change` event and access custom route options to render a template.

```javascript
var Router = require('routy').Router;

var router = new Router(),
    view = document.getElementById('view');

// A full implementation would load templates from elsewhere

router
.add('/', { template: '<h1>Main</h1>' })
.add('/foo', { template: '<h1>Foo</h1>' })
.add('/bar', { template: '<h1>Bar</h1>' })
.otherwise('/')
.on('change', changeView);

function changeView (req) {
    view.innerHTML = req.route.options.template;
}

router.run();
```

### Intercept route changes + redirect

You can intercept the `beforeChange` event to apply a redirect by setting a `.redirect` value on a `Routy.Router` instance.

```javascript
var Router = require('routy').Router;

var router = new Router(),
    isLoggedIn = false;

router
.add('/')
.add('/private-view', { requiresLogin: true })  // Custom option
.add('/login')
.otherwise('/')
.on('beforeChange', intercept);

function intercept (req) {
    if (req.route.options.requiresLogin) {
        // Use the router.redirect property to redirect to a different path
        router.redirect = '/login';
    }
}

router.run();

```

### Intercept route changes + cancel

When intercepting `beforeChange` you can also just cancel route change before it happens by setting the `.cancel` property to true.

```javascript
var Router = require('routy').Router;

var router = new Router();

router
.add('/')
.add('/locked')
.otherwise('/')
.on('beforeChange', intercept);

function intercept (req) {
    if (req.route.path === '/locked') {
        // Use the router.cancel property to prevent redirection
        router.cancel = true;
    }
}

router.run();

```

### HTML5 mode

Hashbangs are not exactly the fanciest way of building routes in a one page app.

Activate HTML5 mode (Uses `history.pushState`) to have clean URL routes.

When the page is initialised they will parse the current `location.pathname` and execute on the appropriate route.

HTML5 mode will also listen for clicks on `<a>` tags and replace the default behaviour of relative links.

```javascript
var Router = require('routy').Router;

var router = new Router();

router
.add('/')
.add('/foo')
.otherwise('/')
.html5()
.on('change', onChange);

function onChange (req) {
    console.log(location.pathname);
    // "/foo"
}

router.run();

```

## Router API

* `.add(route_pattern, [ route_function ], [ route_options ])` - Add a route with custom options and callback function
* `.otherwise(redirect_path)` - Set a default path string to redirect to when trying to access an undefined route
* `.run()` - Start listening to hash change events
* `.stop()` - Stop listening to hash change events
* `.refresh()` - Re-trigger route behaviour based on current path
* `.goTo(path)` - Direct to a given path
* `.html5([ state ])` - Pass a boolean (Defaults to `true`) to set / unset HTML5 mode

## Develop

1. Clone the repo and install the dependencies

```
git clone git@github.com:KanoComputing/routy.js.git
cd routy.js
npm install
```

2. Update the build

```
npm run build
```

## Licence

Copyright (c) 2014 Kano Computing Ltd. - Released under the [MIT license](https://github.com/KanoComputing/routy.js/blob/master/LICENSE)