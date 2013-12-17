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
