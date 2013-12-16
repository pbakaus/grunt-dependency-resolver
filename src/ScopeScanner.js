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

var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var globals = require('./data/globals.json');
var transformers = require('./data/transformers.js');
var cache = {};

function escapeForRegexp(str) {
	return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

function findCompleteIdentifier(lines, identifier) {
	var line = lines[identifier.loc.start.line - 1];
	var sub = line.substr(identifier.loc.start.column);
	var re = new RegExp(escapeForRegexp(identifier.name) + "[^\\(\\)\\;\\,\\s\\}\\[\\]\\&\\=\\-\\+\\*\\?\\!]*");

	var match = re.exec(sub);
	return match[0];
};

function isBrowserGlobal(str) {
	return globals[str];
};

exports.initializeCache = function() {

	if(!fs.existsSync('.s5grunt')) {
		fs.mkdirSync('.s5grunt');
	}

	if(!fs.existsSync('.s5grunt/.scopecache')) {
		return cache;
	} else {
		return cache = JSON.parse(fs.readFileSync('.s5grunt/.scopecache', 'utf8'));
	}

};

exports.saveCache = function() {
	fs.writeFileSync('.s5grunt/.scopecache', JSON.stringify(cache));
};

exports.scan = function(fileName, useTransformers) {

	var stat = fs.statSync(fileName);
	var path = fs.realpathSync(fileName);

	// if we have a fresh cached result, return it!
	//console.log(cache[path].m, typeof stat.mtime);
	if(cache[path] && cache[path].m === stat.mtime.getTime()) {
		return cache[path].r;
	}

	// read the file into a string and a line array
	var file = fs.readFileSync(fileName, 'utf-8');

	// replace dynamic scope creators with stuff esprima understands
	if(useTransformers) {
		for(var transformer in transformers) {
			file = transformers[transformer](file);
		}
	}

	var lines = file.match(/^.*((\r\n|\n|\r)|$)/gm);

	// parse JS into AST, then have escope analyze the scope
	try {
		var ast = esprima.parse(file, { range: false, loc: true });
	} catch(e) {
		throw e.toString() + ' (in ' + fileName + ')';
	}
	
	var scope = escope.analyze(ast).scopes;
	var through = scope[0].through;
	var variables = scope[0].variables.map(function(v) { return v.name; });


	var matches = through
		// filter out any variables declared in the file-global scope
		.filter(function(t) {
			return (variables.indexOf(t.identifier.name) < 0) && !isBrowserGlobal(t.identifier.name);	
		})
		// extend everything left with the complete call, including sub scopes
		// "jQuery" -> "jQuery.click"
		.map(function(t) {
			return findCompleteIdentifier(lines, t.identifier);
		});

	cache[path] = { m: stat.mtime.getTime(), r: matches };

	return matches;

};
