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

var fs = require('fs'),
	path = require('path'),
	scopeScanner = require('./ScopeScanner'),
	prescanExpressions = require('./data/prescan.js'),
	externalUpdated = {};

var __externals = require('./data/externals.json'), __externalsMerged = false;
var externals = {

	// returns a list of externals merged with the ones passed as options
	getMerged: function(externals) {
		return __externalsMerged ? __externals : (__externals = grunt.util._.merge({}, __externals, externals));
	},

	// lookup if the declaration matches one of the mappings in the externals.
	// update => whether the external should be remotely updated
	// externalFolder => the sub/folder of the project containing all externals
	lookup: function(name, update, externalFolder) {

		var potentials = constructPotentials(name.split('.'), ['.']),
			externalList = externals.getMerged(),
			external, mapping, extName, results = [];

		// loop is three levels deep, unfortunately:
		// 1. for all external definitions...
		// 2. ...get all the defined mappings..
		// 3. ...and match them with all constructed potentials
		loop1: for(extName in externalList) {
			external = externalList[extName];
			loop2: for(mapping in external.mappings) {

				// skip falsy stuff
				if(!external.mappings[mapping]) {
					continue loop2;
				}

				for (var i = 0; i < potentials.length; i++) {
					if(potentials[i] === mapping) {
						results.push([mapping, external, extName]);
					}
				}
			}
		}

		if(results) {

			for (var i = 0; i < potentials.length; i++) {
				for (var j = 0; j < results.length; j++) {
					if(results[j][0] === potentials[i]) {

						mapping = results[j][0];
						external = results[j][1];
						extName = results[j][2];

						// if the external is local, it means the mapping doesn't
						// map to the external folder and does not get refreshed remotely
						if(external.local) {
							return [path.join(external.mappings[mapping]), external];
						
						// otherwise, we're dealing with a normal external dependency
						} else {

							// update or fetch external
							if(external.src && !externalUpdated[extName] && update) {
								externalUpdated[extName] = 1;
								updater.update(extName, external, externalFolder);
							}

							return [path.join(externalFolder, extName, external.mappings[mapping]), external];
						}

					}
				}
			}
		}

		return false;

	}

};

var constructPotentials = function(namespaces, separators) {

	var f = [], f2 = [];

	// construct a list of potential file names
	// that we all check in order
	namespaces.forEach(function(n, i) {

		var f3 = f2.slice();
		f2 = [];
		f3.forEach(function(m) {
			separators.forEach(function(separator) {
				f.push(m + separator + n);
				f2.push(m + separator + n);
			});
		});

		if(i === 0) {
			f.push(n);
			f2.push(n);
		}

	});

	return f.reverse();

};

function buildSkippedArray(required, assigned) {
	var arr = [];
	var obj = grunt.util._.extend({}, required, assigned);
	for(var url in obj) {
		arr.push(url);
	}
	return arr;
}

function buildSkippedObject(arr) {
	var obj = {};
	arr.forEach(function(url) {
		obj[url] = true;
	});
	return obj;
}

var _existCache = {}, _dirCache = {};
function actuallyExists(fileName) {

	var retVal = false,
		dir;

	if(_existCache[fileName]) {
		return _existCache[fileName];
	}

	if(fs.existsSync(fileName)) {

		dir = path.dirname(fileName);

		if(!_dirCache[dir]) {
			_dirCache[dir] = fs.readdirSync(dir);
		}

		retVal = _dirCache[dir].indexOf(path.basename(fileName)) > -1;

	}

	_existCache[fileName] = retVal;
	return retVal;

}

function writeLoader(loader, required, assigned, dest, initiator, build, relativeTo, namespace, subNamespaces) {

	var time = Date.now();

	function relativize(urlObj, relativePath) {
		var relativized = {};
		for(var assign in urlObj) {
			relativized[path.relative(relativePath, assign)] = true;		
		}
		return relativized;
	};

	grunt.log.subhead('\tWriting the bootloader...');

	var output = '/*grunt-created*/\n',
		concat = output,
		fileName, assignedRelative;

	// we definitely need our top namespace created, so make sure it is.
	// Coincidentally, we can't let the user create it in pure JS :/
	output += '(function(global) {'
	output += 'if(!global.' + namespace + ') global.' + namespace + ' = {};'
	subNamespaces.forEach(function(subspace) {
		subspace = namespace + '.' + subspace.replace('/', '.');
		output += 'if(!global.' + subspace + ') global.' + subspace + ' = {};'
	});
	output += '})(this);\n';

	// if we're not in build, we need to relativize the pathes
	// to the files in terms of where the final loader is loaded
	// from.
	if(!build) {
		assignedRelative = relativize(assigned, relativeTo);
	}

	// required files have to be appended before loading
	// anything else
	for(fileName in required) {
		output += grunt.file.read(fileName) + '\n';
	}

	// concatenate all files
	for(fileName in assigned) {
		concat += grunt.file.read(fileName) + '\n';
	}

	// attach run code (that initializes the code)
	concat += initiator;

	if (build) {
		output += concat;
	} else {
		// create a dynamic loader that simply loads all files in order
		output += loader.syntax
					.replace('$FILES', '["' + Object.keys(assignedRelative).join('",\n"') + '"]')
					.replace('$INITIATOR', initiator);
	}

	grunt.file.write(dest, output);
	grunt.log.writeln('\tSaved ' + (build ? 'concatenated build' : 'dynamic bootloader') + ' to ' + dest.cyan + ' (' + output.length + ' bytes), took ' + ((Date.now() - time)+'').green + ' ms.');

	return {
		concat: concat,
		ignored: buildSkippedArray(required, assigned)
	};

};

function findDeclarations(prescan, callback) {

	var findStart = Date.now();
	var declarations = {};

	if(prescan.match) {
		prescanExpressions.__extra = prescan.match;
	}

	function getExtension(filename) {
		var ext = path.extname(filename || '').split('.');
		return ext[ext.length - 1];
	}

	var walk = function(dir, done, rec) {
		var results = [];
		fs.readdir(dir, function(err, list) {
			if (err) return done(err);
			var pending = list.length;
			if (!pending) return done(null, results);
			list.forEach(function(file) {

				var justFile = file;
				file = (dir + '/') + file;

				// don't process hidden folders
				if(justFile.substr(0,1) === '.') {
					--pending;
					return;
				}

				fs.stat(file, function(err, stat) {
					if (stat && stat.isDirectory()) {
						walk(file, function(err, res) {
							results = results.concat(res);
							if (!--pending) done(null, results);
						}, true);
					} else {
						results.push(file);
						if (!--pending) done(null, results);
					}
				});
			});
		});
	};


	var counter = prescan.directories.length;
	var allResults = [];
	prescan.directories.forEach(function(directory) {
		walk(directory, function(err, results) {

			allResults = allResults.concat(results);

			if(!--counter) {
				results.forEach(function(fileName) {

					if(getExtension(fileName) !== 'js') {
						return;
					}

					var file = fs.readFileSync(fileName, 'utf-8');

					// do not process files that are created by one of our grunt tools
					if(file.indexOf('grunt-created') > -1) {
						return;
					}

					for(var lib in prescanExpressions) {

						var pattern = new RegExp(prescanExpressions[lib]),
							match;

						while (match = pattern.exec(file)) {
							declarations[match[2]] = fileName;
						}

					}

				});

				callback(declarations, Date.now() - findStart);				
			}

		});
	});

}

var grunt = null;
var updater;
module.exports = function(g) {
	grunt = g;
	updater = require('./ExternalUpdater')(grunt);
	return module.exports;
}

module.exports.resolve = function(src, dest, initiator, skip, skipLoader, options, callback) {

	var ignored = options.ignored,
		assigned = {},
		staged = {},
		required = {},
		declarations = {},
		unresolved = [],
		unresolvedUrlMappings = {},
		ignoredMappings = {};
	
	skip = buildSkippedObject(skip);

	// if build is enabled, we'' also want to ignore namespaces that we want to
	// have groundskeeper filter out
	if(options.build.enabled) {
		ignored = ignored.concat((options.build.groundskeeper && options.build.groundskeeper.namespace) || []);
	}

	if(options.externals.map) {
		externals.getMerged(options.externals.map);
	}

	if(options.externals.update !== false)
		grunt.log.subhead("\tUpdate all external dependencies...");

	var _isIgnored = function(name) {
		for (var i = 0; i < ignored.length; i++) {
			if(ignored[i] === name.substr(0, ignored[i].length)) {
				return true;
			}
		}
		return false;
	};

	var _assign = function (arr, req) {

		var fileName = arr[0];
		var parentExternal = arr[1];

		// skip classes that are already assigned.
		if (assigned[fileName] || skip[fileName]) {
			return false;
		}

		//Recurse before adding the child.
		_recurse(fileName, false, req, parentExternal);

		if (req) {
			required[fileName] = true;
		} else {
			assigned[fileName] = true;
		}

		return true;
	};

	var _recurse = function (url, firstTime, req, parentExternal) {

		if (staged[url]) {
			return false;
		}

		grunt.verbose.writeln('Recursing through: ' + url);

		// add url as staged
		staged[url] = true;

		// retrieve scanned scope (undeclared variables in this file)
		var results = scopeScanner.scan(url, false, options.namespace);

		var actuals = [], actual, a;
		var skipped = [];
			
		if (!results) {
			return;
		}

		// split out namespaces, attempt to find all potentials, i.e.:
		// boiler.plate.do() could match:
		// => boiler/plate/do.js
		// => boiler/plate.do.js
		// => boiler.plate/do.js
		// => boiler.plate.do.js
		function checkEveryPossibleScenario(result, namespaces) {

			var found = [], retVal = false;

			// if we want to ignore the namespace in build mode, do so
			if(_isIgnored(result)) {
				return [[], true];
			}

			// if we found it declared in a file we pre-scanned,
			// awesome! no crazy lookup needed.
			var declaration = declarations[result] && declarations[result].substr(0, declarations[result].length - 3);

			if(declaration && actuallyExists(declaration + '.js')) {

				// if the declaration matched is in the external folder, we might still want
				// to update it, so run the lookup tool to simply update the external.
				// TODO: find a better optimized way, lots of loops required..
				if(options.externals.update && declaration.indexOf(options.externals.output) === 0) {
					externals.lookup(result, options.externals.update, options.externals.output);
				}

				found.push(declaration + '.js');
				retVal = true;
			}
			else {

				// construct a list of potential file names
				// that we all check in order
				var potentials = constructPotentials(namespaces, ['.', '/']);
				potentials.forEach(function(potential) {

					// add file extension for lookup
					potential += '.js';

					// skip pre-staged files (so they're not checked multiple times)
					if (staged[potential]) {
						if (skipped.indexOf(potential) === -1) {
							skipped.push(potential);
						}
						retVal = true;
						return;
					}

					// if the file exists, collect it
					if (actuallyExists(potential)) {
						found.push(potential);
						retVal = true;
					}

				});

			}

			return [found, retVal];

		};

		results.forEach(function(result) {

			var namespaces = result.split('.');
			var extMapping;

			// first, check without any mapping
			var fileResults = checkEveryPossibleScenario(result, namespaces);

			// if the return value is false (nothing was found or skipped)
			// rerun the with a correct mapping
			if(!fileResults[1]) {

				extMapping = externals.lookup(result, options.externals.update, options.externals.output);
				if(extMapping) {
					namespaces[0] = extMapping[0];
					fileResults = checkEveryPossibleScenario(result, namespaces);
				}

			}

			fileResults[0].forEach(function(file) {
				actuals.push([file, extMapping && extMapping[1]]);
			});

			// if the thing is completely unresolved still, track
			if(!fileResults[0].length && !fileResults[1]) {

				if(unresolvedUrlMappings[result]) {
					if(unresolvedUrlMappings[result].indexOf(url.cyan) === -1)
						unresolvedUrlMappings[result].push(url.cyan);
				} else {
					unresolvedUrlMappings[result] = [url.cyan];
				}

				// we might want to ignore the unmapped warnings
				if(parentExternal && parentExternal.ignoreUnmapped === true) {
					ignoredMappings[result] = true;
				} else {
					if(unresolved.indexOf(result) === -1)
						unresolved.push(result);
				}
			}

		});

		if (skipped.length > 0) {
			grunt.verbose.writeln('  Skipped ' + skipped.length + ' already included class(es): ', grunt.log.wordlist(skipped, { color: 'yellow' }));
		}

		grunt.verbose.writeln('  Discovered: ' + actuals.length + ' actual match(es): ', grunt.log.wordlist(actuals, { color: 'green' }), '\n');

		// Push em in bro! 
		// We checked for assigned but then recurse!
		// In _assign we check for pre-inclusion.
		for (a = 0; a < actuals.length; a++) {
			actual = actuals[a];
			!_assign(actual, req) ? skipped.push(actual[0]) : null;
		}

		// finally, add this URL below the dependencies.
		if (firstTime) {
			_assign([url, false], req);
		}

	};

	// find all declarations that we can detect in all files in the repo
	findDeclarations(options.prescan, function(decl, declTime) {

		// initialize the scope scanner cache
		scopeScanner.initializeCache();

		var resolveStart = Date.now();
		declarations = decl;

		// if we're in source mode, resolve loader dependencies
		// before anything else
		if(!options.build.enabled && !skipLoader) {
			_recurse(options.loader.src, true, true);
		}
		
		// recurse starting from the current fileName
		_recurse(src, true);
		grunt.log.subhead("\tResolved and sorted all dependencies (took " + ((Date.now() - resolveStart) + '').bold + " ms):");

		// logging
		var requiredArray = Object.keys(required);
		grunt.log.writeln('\t' + requiredArray.length + ' ' + 'pre-required'.inverse + ' classes (based on loader dependency):');
		requiredArray.forEach(function(r) {
			grunt.log.writeln('\t- ' + r.cyan);
		});

		var assignedArray = Object.keys(assigned);
		grunt.log.writeln('\t' + assignedArray.length + ' ' + 'required remaining'.inverse + ' classes:');
		assignedArray.forEach(function(r) {
			grunt.log.writeln('\t- ' + r.cyan);
		});

		// construct list of sub namespaces
		var subNamespaces = [], uniqueCheck = {};
		assignedArray.forEach(function(fileName) {
			var sub = path.relative(options.source, path.dirname(fileName));
			if(sub && sub.substr(0,2) !== '..' && !uniqueCheck[sub]) {
				subNamespaces.push(sub);
				uniqueCheck[sub] = 1;
			}
		});

		// write the actual JS build/loader file
		var writeResult = writeLoader(options.loader, required, assigned, dest, initiator, options.build.enabled, options.relativeTo, options.namespace, subNamespaces);

		// we scan all concatenated files at once for any leftovers,
		// then substract ignored mappings and the ones that are resolved.
		if(options.checkForUnresolved) {

			var unresolvedTime = Date.now();

			// let's assume it's safe to assume that we only have to update this one
			// if the filesize changes..
			if(!fs.existsSync('.s5grunt/.unresolvedcache') || fs.statSync('.s5grunt/.unresolvedcache').size !== writeResult.concat.length) {
				grunt.file.write('.s5grunt/.unresolvedcache', writeResult.concat);
			}

			var results = scopeScanner.scan('.s5grunt/.unresolvedcache', true)
				.filter(function(r) {
					return !(ignoredMappings[r] || unresolved.indexOf(r) === -1);
				});

			// we only want uniques!
			results = results.reverse().filter(function (e, i, arr) {
				return results.indexOf(e, i+1) === -1;
			}).reverse();

			// nice colors for the console
			results = results.map(function(r) {
				return r.yellow + ' (' + unresolvedUrlMappings[r] + ')';
			});

			grunt.log.writeln('\n\t' + results.length + ' ' + 'unresolved '.inverse + ' declarations (took ' + ((Date.now() - unresolvedTime) + '').bold + ' ms):');
			results.forEach(function(r) {
				grunt.log.writeln('\t- ' + r);
			});

		}

		// save scope scanner cache
		scopeScanner.saveCache();

		// end resolver
		callback(writeResult.ignored);

	});

};