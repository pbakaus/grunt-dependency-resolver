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

	// Project configuration.
	grunt.initConfig({
		// Before generating any new files, remove any previously-created files.
		clean: {
			tests: ['tmp'],
		},

		// Configuration to be run (and then tested).
		resolveDependencies: {
			
		}

	});

	// Actually load this plugin's task(s).
	grunt.loadTasks('tasks');

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-clean');

	// Whenever the "test" task is run, first clean the "tmp" dir, then run this
	// plugin's task(s), then test the result.
	grunt.registerTask('test', ['clean', 'resolveDependencies']);

	// By default, lint and run all tests.
	grunt.registerTask('default', ['test']);

};
