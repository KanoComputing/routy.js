# Routy.js

> A dead simple module to manage hash routing in the browser.

## Install

You can either use the module with npm

    `npm install routy`

Or include the file `build/Routy.js` in your HTML (which provides a wrapper at `window.Routy`)

## Example Usage

```javascript
var Router = Require('routy').Router;

var myRouter = new Router();

function index () {
    // ...
}

function logParams (req) {
    console.log(req.namedParams);
}

function logOptions (req) {
    console.log(req.route.options);
}

myRouter
.add('/', index)
.add('/foo/:apples', logParams)
.add('/bar', logOptions, { someOption: 'wooah' })
.on('change', function (req, route) {
    console.log('Changing to path: ' + req.path)
});
```

## Simple templates example

```javascript
var Router = require('routy').Router;

var router = new Router(),
    view = document.getElementById('view');

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

## Router API

* `.add(route_pattern, [ route_function ], [ route_options ])` - Add a route with custom options and callback function
* `.otherwise(redirect_path)` - Set a default path string to redirect to when trying to access an undefined route
* `.run()` - Start listening to hash change events
* `.stop()` - Stop listening to hash change events
* `.refresh()` - Re-trigger route behaviour based on current path

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