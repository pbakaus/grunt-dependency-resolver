// use some jQuery to wait for DOMReady, then call sample.foo (which lives in foo.js)
$(document).ready(function() {
	sample.foo();
	sample.sub.foo();
	console.log("I am only logging in source mode!");
});