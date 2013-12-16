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
var httpSync = require('http-sync');

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

	var parsed = urlParse.parse(uri);
	var protocol = parsed.protocol.substr(0, parsed.protocol.length-1);
	var req = httpSync.request({
		method: 'GET',
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.97 Safari/537.11",
			"Referer": "http://www.zynga.com",
			"Accept-Encoding": "gzip,deflate,sdch",
			"encoding": "null",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Cookie": "cookie"
		},

		protocol: protocol,
		host: parsed.host,
		port: parsed.port || (protocol === 'https' ? '443' : '80'), //443 if protocol = https
		path: parsed.path
	});

	var response = req.end();

	if(response.statusCode !== 200) {
		grunt.log.error('Error! Resource came back with the wrong response code: ', response);
	} else {
		grunt.log.write(' => ' + ('downloaded ' + response.body.length + ' bytes').green);
	}

	var tempFileName = '.s5grunt/' + name;

	// exit here if the resource has the same size as the cached one
	if(fs.existsSync(tempFileName) && fs.statSync(tempFileName).size === response.body.length) {
		grunt.log.writeln(', resource unchanged'.yellow);
		return;
	}

	// write zip file to tmp location
	fs.writeFileSync(tempFileName, response.body);

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

	var parsed = urlParse.parse(uri);
	var protocol = parsed.protocol.substr(0, parsed.protocol.length-1);

	var req = httpSync.request({
		method: 'GET',
		protocol: protocol,
		host: parsed.host,
		port: parsed.port || (protocol === 'https' ? '443' : '80'), //443 if protocol = https
		path: parsed.path
	});
	var response = req.end();

	if(response.statusCode !== 200) {
		grunt.log.error('wrong http status code! ', response);
	}

	// exit here if the resource has the same size as the cached one
	if(fs.existsSync(destination + name) && fs.statSync(destination + name).size === response.body.length) {
		grunt.log.writeln(' => ' + 'no changes detected'.yellow);
		return;
	}

	fs.writeFileSync(destination + name, response.body);
	grunt.log.writeln(' => ' + ('downloaded ' + response.body.length + ' bytes to ' + destination).green);

};

function _updateGitRepo(branch, uri, dest, name, externalFolder, silent) {
	
	var arg = 'git pull origin ' + branch;
	var tmp = '.s5grunt/' + dest;
	var destination = path.join(externalFolder, dest) + '/';

	var stdout = sh.exec(arg);
	var status = stdout.stdout.split('\n')[2];

	if(!silent)
		grunt.log.writeln(' => ' + (status.indexOf('Already up') > -1 ? status.yellow : status.green));

	if(silent || status.indexOf('Already up') === -1) {

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
