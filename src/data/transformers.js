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

module.exports = {
	"core.Class": function(file) {

		return file.replace(/core\.(Class|Module)\([\"\']([^\"\']+)[\"\']/g, function(full, what, sub) {
			sub = sub.split('.');
			var declared = [], output = '';
			sub.forEach(function(v, i) {
				output += ((i ? '' : 'var ') + declared.join('.') + (i ? '.' : '') + v + ' = {};\n');
				declared.push(v);
			});
			return output + full;
		});

	}
};