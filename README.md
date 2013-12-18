# grunt-dependency-resolver

> A Node Based Task to Automatically Resolve Javascript Dependencies in a Project

# Tasks:

## resolveDependencies

This task takes a Source Directory, an Externals Directory, a Namespace, and a collection of Files.
It will attempt to find Javascript files embedded in the HTML, and then begins it's magic.
It will scan this file and discover all unresolved declarations, finds files that map to these declarations, and generate out a Dependency tree to be loaded in sequence or inlined in order.

Simple Example:
```html
<html>
<head></head>
<body>
		<script src="class/App.js" initiator="new zynga.App();"></script>
</body>
</html>
```

class/App.js
```js
var bacon = new Bacon();
```

Outputs:
```JS
__load(["class/Bacon.js","class/App.js"], function() { new zynga.App(); }, true);
```

processConfig can split out two versions of the Config file, one private.json that contains the private references (for backend configuration), and one public.json that has the private references stripped out. Nifty!

Finally, it can output a javascript file that can be wrapped into any framework you like.


#### options.relativeTo
Type: `String`
Default value: ``

> Helps the resolver understand from where the files get included, so it can relativize pathes in the boot loader and templates.

#### options.namespace
Type: `String`
Default value: `undefined`

> The project namespace. Highly recommended that you use one. ;)

#### options.source
Type: `String`
Default value: `js/`

> Where you store your Application javascripts.

#### options.build
Type: `Object`
Default value: `{}`

#### options.build.enabled
Type: `Boolean`
Default value: `false`

> If true, will inline all javascript on output. Otherwise, outputs an array of url's to load in order.

#### options.externals
Type: `Object`
Default value: `{}`

#### options.externals.update
Type: `Boolean`
Default value: `false`

> If true, will update external dependencies. The resolver can handle Github repositories, Zip files, and JS files.

#### options.externals.output
Type: `String`
Default value: ``

> This is the location where your externals live. Relative to relativeTo (SURPRISE!).

#### options.externals.map
Type: `Object`
Default value: `{}`

> This is the magical mappings object. We by default provide mappings to: jQuery, Zynga Scroller, and Zynga Core.

##### Mappings Examples
```json
"jquery": {
	"src":  "http://code.jquery.com/jquery-2.0.3.min.js",
	"mappings": {
		"$": "jquery-2.0.3.min",
		"jQuery": "jquery-2.0.3.min"
	}
}
```
If your javascript code has an unresolved declaration of $ or jQuery, the Dependency Resolver will load jQuery-2.0.3.min.js into your Externals directory, and map the file into the output in the correct load order.

```json
"Scroller": {
	"src":  "https://github.com/zynga/scroller.git",
	"branch": "master",
	"mappings": {
		"Scroller": "src/Scroller"
		}
}
```
This example checks out the Github Repo for Zynga Scroller on the Master branch and places it into your Externals directory. It then maps Scroller to the path where Scroller.js lives in Zynga Scroller (src/Scroller).

```json
"cards": {
	"mappings": { "cards": "cards"},
	"ignoreUnmapped": true
}
```
This example is a fun one. We don't want the most up-to-date cards.js, so we manually update it on occasion. This means we check in cards/card.js to our Externals directory and the Dependency Resolver just uses it.

### Usage Example

```js
 // never include JS files manually again. Yes, really.
resolveDependencies: {
  source: {
    options: {
      namespace: 'sample'
    },

    src: 'index.source.html',
    dest: 'index.html'
  }
}
```

This example reads the index.source.html, which contains a reference to js/main.js. js/main.js requires jQuery and js/foo.js. Our output will be in this order: ['js/foo.js','PATH/TO/JQUERY/jQuery.js','js/main.js'].
