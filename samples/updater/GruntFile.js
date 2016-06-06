//This is to test downloading external
module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// never include JS files manually again. Yes, really.
		resolveDependencies: {
			options: {
				// help the resolver understand from where the files get included
				// so it can relativize pathes in the boot loader and templates
				relativeTo: './',

				namespace: '<%= pkg.name %>',
				//js source
				source: 'source',

				build: {
					enabled: false
				},
				// External maps to resolve variables to external projects.
				externals: {
					update: true,
					output: 'external'
				},
				ignored: []

			},

			source: {
				options: {
					namespace: 'sample'
				},

				src: 'templates/index.html',
				dest: 'index.html'
			}
		}
	});

	// include the npm task
	grunt.loadNpmTasks('grunt-dependency-resolver');
	//grunt.loadNpmTasks('grunt-cruncher');

	// source task shortcut (for development)
	grunt.registerTask('source', ['resolveDependencies:source']);

};
