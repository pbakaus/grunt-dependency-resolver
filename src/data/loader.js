/*
 *
 * grunt-dependency-resolver
 * http://github.com/zynga/grunt-dependency-resolver
 *
 * Copyright 2013, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/grunt-dependency-resolver/master/LICENSE-MIT
 *
 */

// Inspired and largely copied from Core (https://github.com/zynga/core) LICENSE-MIT

(function(global) {

	var doc = global.document,
		ua = navigator.userAgent;

	// the following is a feature sniff for the ability to set async=false on dynamically created script elements, as proposed to the W3C
	// RE: http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
	var supportsScriptAsync = doc.createElement("script").async === true;
	var SUPPORTS_PARALLEL = supportsScriptAsync || (ua.indexOf('Gecko') > -1 && ua.indexOf('rv:') > -1);
	var dynamicExtension = "?r=" + Date.now();

	var assignCallback = function(elem, value) {
		elem.onload = elem.onerror = value;
		if (!("onload" in elem)) {
			elem.onreadystatechange = value;
		}
	};

	var loadScript = function(uri, callback, nocache) {

		var head = doc.head;
		var elem = doc.createElement("script");

		// load script via 'src' attribute, set onload/onreadystatechange listeners
		assignCallback(elem, function(e) {
			var errornous = (e || global.event).type === "error";
			if (errornous) {
				console.warn("Could not load script: " + uri);
			} else {
				var readyState = elem.readyState;
				if (readyState && readyState !== "complete" && readyState !== "loaded") {
					return;
				}
			}

			// Prevent memory leaks
			assignCallback(elem, null);

			// Execute callback
			callback(uri, errornous, elem);

		});

		elem.src = nocache ? uri + dynamicExtension : uri;

		if (supportsScriptAsync) {
			elem.async = false;
		}

		head.insertBefore(elem, head.firstChild);

		return elem;

	};

	global.__load = function(uris, callback, nocache) {

		var loading = {}; // Keys are all URIs which are currently loading
		var cache = {}; // Data cache for callback return
		var sequential = []; // List of sequential items sorted by type

		var onLoad = function(uri, errornous, data) {

			delete loading[uri];
			
			// Make data available for callback
			if (data != null) {
				cache[uri] = data;
			}

			// Check whether there is more to load
			for (var queued in loading) {
				return;
			}

			// Execute callback
			if (callback) {
				callback(cache);
			}
		};

		// Process all URIs
		for (var i = 0, l = uris.length; i < l; i++) {
			var currentUri = uris[i];

			// When script is not being loaded already, then start with it here
			// (Otherwise we just added the callback to the queue and wait for it to be executed)
			if (!loading[currentUri]) {

				// Register globally as loading
				loading[currentUri] = true;
				
				// Differenciate between loader capabilities
				if (SUPPORTS_PARALLEL) {
					loadScript(currentUri, onLoad, nocache);
				} else {
					// Sort in the URI into a type specific queue
					sequential.push(currentUri);
				}
			}
		}

		var loadNext = function() {
			var uri = sequential.shift();
			if (uri) {
				loadScript(uri, function(uri, errornous, data) {
					onLoad(uri, errornous, data);
					loadNext();
				}, nocache);
			} 
		};
		
		loadNext();

	};

})(this);