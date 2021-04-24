const gulp = require('gulp');
const bs = require('browser-sync').create(); // create a browser sync instance.

/* Run a server in source folder and refresh server and browser if any file inside it changes */
gulp.task('browser-sync', function ()
{
	bs.init({
		files: ["*.*"],
		watch: true,
		server: {
			baseDir: "./"
		}
	});
});
