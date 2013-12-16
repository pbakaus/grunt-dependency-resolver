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

				src: 'index.source.html',
				dest: 'index.html'
			}
		}

	});

	// include the npm task
	grunt.loadNpmTasks('grunt-dependency-resolver');

	// source task shortcut (for development)
	grunt.registerTask('source', ['resolveDependencies',]);

};
