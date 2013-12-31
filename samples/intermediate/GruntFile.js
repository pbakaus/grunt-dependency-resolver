module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// never include JS files manually again. Yes, really.
		resolveDependencies: {

			source: {
				options: {
					namespace: 'sample'
				},

				src: 'templates/index.html',
				dest: 'index.html'
			},

			build: {
				options: {
					namespace: 'sample',
					build: {
						enabled: true,
						groundskeeper: {
							console: false
						}
					},
					output: function(fileName) {
						return fileName.replace(/.js$/, '.concatenated.js');
					}
				},

				src: 'templates/index.html',
				dest: 'index.built.html'
			}
		},

		// MAGIC.
		inlineEverything: {
			build: {
				src: 'index.built.html',
				dest: 'build/index.html'
			}
		}

	});

	// include the npm task
	grunt.loadNpmTasks('grunt-dependency-resolver');
	grunt.loadNpmTasks('grunt-cruncher');

	// source task shortcut (for development)
	grunt.registerTask('source', ['resolveDependencies:source']);

	// build task that concatenates dependencies
	grunt.registerTask('build', ['resolveDependencies:build', 'inlineEverything:build']);

};
