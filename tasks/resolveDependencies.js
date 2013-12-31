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

'use strict';

module.exports = function(grunt) {

	grunt.registerMultiTask('resolveDependencies', 'automatically resolve all of your JS file dependencies', function() {

		// Tell grunt this task is asynchronous.
		var done = this.async();

		// dependencies
		var fs = require('fs');
		var path = require('path');
		var resolver = require('../src/Resolver.js')(grunt);
		var CDNList = require('../src/data/cdn.json');
		var groundskeeper = require('groundskeeper');

		// Merge task-specific and/or target-specific options with these defaults.
		var options = this.options({

			// declarationMatcher specific options
			prescan: {
				match: null,
				directories: []
			},

			loader: {

				// where your favorite script loader lives.
				src: 'node_modules/grunt-dependency-resolver/src/data/loader.js',

				// the syntax the script loader requires to load the files needed.
				// $FILES gets replaced with an array of URLs, while $INITIATOR gets
				// replaced with the code you specified the initiator argument on the
				// actual <script> tag.
				syntax: '__load($FILES, function() { $INITIATOR }, true);'

			},

			// ignores certain namespaces
			ignored: [],

			// check for unresolved globals (slower)
			checkForUnresolved: true,

			externals: {
				update: true,
				output: 'external'
			},

			build: {
				enabled: false,
				groundskeeper: false
			},

			output: function(fileName) {
				return fileName.replace(/.js$/, '.linked.js');
			},

			relativeTo: '',
			namespace: false,
			substitutionMap: false /* put a path in here otherwise */

		});

		var files = this.files;
		var ignoreThese = [];
		var loaderDone = false;
		var fileSources = [];
		var substitutionMap = {};

		function determineSourceDestination() {

			var shortest = 'woooohooooooiamdefinitelynottheshortestpath';

			fileSources.forEach(function(templateFiles) {
				templateFiles.forEach(function(filePair) {
					var candidate = path.join(options.relativeTo, path.dirname(filePair[1]));
					if(candidate.length < shortest.length) {
						shortest = candidate;
					}
				});
			});

			if(!options.source) {
				options.source = shortest;
			}

			// namespace is a short cut for defining a local mapping
			// in the externals
			if(options.namespace) {
				options.externals.map = options.externals.map || {};
				var mapping = {};
				mapping[options.namespace] = options.source;
				grunt.util._.extend(options.externals.map, {
					__defaultNamespace: {
						mappings: mapping,
						local: true
					}
				});
			}

			// extend folder list for declarationMatcher
			if(options.prescan) {
				options.prescan.directories = grunt.util._.union(options.prescan.directories || [], [options.externals.output, options.source]);
			}

		}

		function replaceScriptUrls(html, fn) {

			html = html.replace(/(<script[^\>]+src\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*\><\/script>)/g, function(full, start, fileName, end) {
				var initiator = (start + end).match(/initiator\=(["'])((?:(?!\1).)*)\1/);
				var substitutedName = fn(fileName, initiator ? initiator[2] : '');
				substitutionMap[fileName] = substitutedName;
				return start + substitutedName + end;
			});

			return html;

		};

		function addCDNtoIgnoreList(html) {

			html.replace(/<script[^\>]+src\=[\"\']((?:https\:|http\:)?\/\/[^\"\']+)[\"\'][^\>]*\><\/script>/g, function(full, url) {

				var mapping;
				for(var regex in CDNList) {
					mapping = CDNList[regex];
					if(grunt.file.isMatch(regex, url)) {
						if(typeof mapping === 'string') {
							if(options.ignored.indexOf(mapping) === -1) {
								options.ignored.push(mapping);
							}
						} else {
							mapping.forEach(function(m) {
								if(options.ignored.indexOf(m) === -1) {
									options.ignored.push(m);
								}
							});
						}
					}
				}

				return full;
			});

		};

		function runResolver() {

			// if there are no files linked, fail!
			if(!fileSources.length) {
				grunt.fail.warn('You have not included any JavaScript files in your project.');
			}

			// save substitution map of all replaced files
			if(options.substitutionMap) {
				grunt.file.write(options.substitutionMap, JSON.stringify(substitutionMap));
			}

			var sources = fileSources.shift();
			var counter = sources.length;

			// run resolver for every found file
			sources.forEach(function(source) {

				grunt.log.subhead("Resolving script path " + source[0].cyan + '...');
				grunt.log.writeln("Ignored declarations: ", grunt.log.wordlist(options.ignored, { color: 'red' }));

				// run resolver to create loader file
				resolver.resolve(source[0]/*base*/, source[1]/*dest*/, source[2], ignoreThese, loaderDone, options, function(resolved) {

					// add to ignore list so they don't get included when fetching the next
					ignoreThese = ignoreThese.concat(resolved);
					loaderDone = true;

					if(options.build.enabled && options.build.groundskeeper) {
						// strip out stuff, but only if we're in build mode
						var cleaner = groundskeeper(options.build.groundskeeper);
						var file = fs.readFileSync(source[1], 'utf8');

						cleaner.write(file);
						fs.writeFileSync(source[1], cleaner.toString(), 'utf8');						
					}

					if(!--counter) {
						if(fileSources.length) {
							runResolver();
						} else {
							done();
						}
					}

				});

			});

		};

		function processFiles() {

			// remove the working file from array
			var file = files.shift();

			// get the contents of the source template(s)
			var contents = file.src.filter(function(filepath) {
					// Remove nonexistent files (it's up to you to filter or warn here).
					if (!grunt.file.exists(filepath)) {
						grunt.log.warn('\tSource file "' + filepath + '" not found.');
						return false;
					} else {
						return true;
					}
				}).map(function(filepath) {
					// Read and return the file's source.
					return grunt.file.read(filepath);
				}).join('\n');

			// replace URLs in the template and save the results
			var sources = [];
			contents = replaceScriptUrls(contents, function(fileName, initiator) {

				// TODO: make dynamic
				var resolvedName = options.output(fileName);

				// push to sources list
				sources.push([
					path.join(options.relativeTo, fileName),
					path.join(options.relativeTo, resolvedName),
					initiator
				]);

				// return new file name
				return resolvedName;

			});

			// add to local ignore list
			addCDNtoIgnoreList(contents);

			// save updated template to destination
			grunt.file.write(file.dest, contents);

			if(sources.length) {
				fileSources.push(sources);
			}

			if(files.length) {
				processFiles();
			} else {

				// determine source path based on LCM on files
				determineSourceDestination();

				runResolver();
			}

		}

		processFiles();

	});

};
