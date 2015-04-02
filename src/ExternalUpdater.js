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

var fs = require('fs');
var wrench = require('wrench');
var http = require('http');
var urlParse = require('url');
var exec = require('child_process').exec;
var AdmZip = require('adm-zip');
var path = require('path');
var colors = require('colors');
var sh = require('execSync');

var logLevel = 0;
var _log = function (str, level) {
	if(logLevel >= level) console.log('\t' + str);
};

function getExtension(filename) {
	var ext = path.extname(filename || '').split('.');
	return ext[ext.length - 1];
}

function downloadZip(uri, dest, name, externalFolder) {
	grunt.log.write('\t- ' + name.yellow + ' (zip): ' + uri.bold);

	var tempFileName = '.s5grunt/' + name;

	var res = sh.exec('wget -O ' + tempFileName + ' ' + uri);
	if(res.statusCode !== 0) {
		grunt.fail.warn('Error! Download ' + uri + "Failed", res.stdout);
	} else {
		grunt.log.write(' => ' + ('Downloaded to ' + tempFileName).green);
	}

	var zip = new AdmZip(tempFileName),
		zipEntries = zip.getEntries();
	var zipDest = path.join(externalFolder, dest);
	zip.extractAllTo(zipDest, true);

	grunt.log.writeln((', extracted to ' + zipDest).green);
};

function downloadScript(uri, dest, name, externalFolder) {
	grunt.log.write('\t- ' + name.cyan + ' (http):  ' + uri.bold);

	var destination = path.join(externalFolder, dest) + '/';

	// create directory if it doesn't exist
	if (!fs.existsSync(destination)) {
		fs.mkdirSync(destination);
	}

	var res = sh.exec('wget -O ' + destination + name + ' ' + uri);
	if (res.code !== 0) {
		grunt.log.error('Error! Download ' + uri + "Failed");
	} else {
		grunt.log.writeln(' => ' + ('Downloaded to ' + destination + name).green);
	}
};

function checkoutSuccess(stdout) {
	if (stdout && stdout.indexOf("error") === -1) {
		return true;
	}
	return false;
}

function hasUpdates(stdout) {
	if (stdout && stdout.indexOf("Already on") > -1) {
		return false;
	}
	return true;
}

function _updateGitRepo(branch, uri, dest, name, externalFolder, silent) {
	
	var arg = 'git fetch && git checkout ' + branch;
	var tmp = '.s5grunt/' + dest;
	var destination = path.join(externalFolder, dest) + '/';

	var stdout = sh.exec(arg);
	var status = stdout.stdout;

	if(!silent)
		grunt.log.writeln(' => ' + (checkoutSuccess(status) ? status.green : status.yellow));

	if(silent || hasUpdates(status)) {

		process.chdir('../../');

		wrench.copyDirSyncRecursive(tmp, destination, {
			forceDelete: true,
			excludeHiddenUnix: true
		});

	}

};

function _checkoutGitRepo(branch, uri, dest, name, externalFolder, silent) {
	var arg = 'git checkout ';

	//var destination = 'external/' + dest + '/';
	var toBranch = 'master';

	if (typeof(uri) === 'object') {
		toBranch = uri.branch || toBranch;
	}

	arg += toBranch;

	if (toBranch !== branch) {
		var stdout = sh.exec(arg);
		_updateGitRepo(toBranch, uri, dest, name, externalFolder, silent);
	} else {
		_updateGitRepo(branch, uri, dest, name, externalFolder, silent);
	}

};

function downloadGitRepo(uri, dest, name, externalFolder) {

	var arg = 'git ';
	var cwd = process.cwd();
	var destination = '.s5grunt/' + dest;
	//var destination = 'external/' + dest + '/';
	var theUrl = uri.url ? uri.url : uri;

	grunt.log.write('\t- ' + name.green + ' (git): ' + theUrl.bold);

	// update the repo if it is already cloned,
	// otherwise clone the git repository.
	if (fs.existsSync(destination)) {
		process.chdir(cwd + '/' + destination);
		arg += 'rev-parse --abbrev-ref HEAD';
		var stdout = sh.exec(arg).stdout.trim();

		_checkoutGitRepo(stdout, uri, dest, name, externalFolder);

	} else {
		arg += 'clone ' + theUrl + ' ' + destination;
		// execute the command

		var output = sh.exec(arg);
		grunt.log.write(' => ' + output.stdout.green);
		process.chdir(cwd + '/' + destination);
		_checkoutGitRepo('master', uri, dest, name, externalFolder, 1);

	}

	process.chdir(cwd);

};

var grunt = null;
module.exports = function(g) {

	if(!fs.existsSync('.s5grunt')) {
		fs.mkdirSync('.s5grunt');
	}

	grunt = g;
	return module.exports;
}

module.exports.update = function(name, external, externalFolder) {

	var url = external.src.url || external.src;
	var spl = url.split('/');
	var fileName = spl[spl.length - 1];
	var host = spl[2];
	var extension = getExtension(fileName);

	// if the external folder does not exist, create it
	if(!fs.existsSync('external')) {
		fs.mkdirSync('external');
	}

	switch(extension) {
		case 'zip':
			downloadZip(external.src, name, fileName, externalFolder);
			break;
		case 'js':
			downloadScript(external.src, name, fileName, externalFolder);
			break;
		case 'git':
			downloadGitRepo(external.src, name, fileName, externalFolder);
			break;
	}

};
