'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      gruntfile: {
        src: ['Gruntfile.js']
      },
      code: {
        src: ['app.js','config/**/*.js', 'models/**/*.js','routes/**/*.js']
      }
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      lib: {
        files: '<%= jshint.lib.src %>',
        tasks: ['jshint:lib', 'nodeunit']
      },
      test: {
        files: '<%= jshint.test.src %>',
        tasks: ['jshint:test', 'nodeunit']
      }
    },
      jasmine_node: {
          specNameMatcher: "spec", // load only specs containing specNameMatcher
          projectRoot: ".",
          requirejs: false,
          forceExit: true,
          jUnit: {
              report: false,
              savePath : "./build/reports/jasmine/",
              useDotNotation: true,
              consolidate: true
          }
      }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-jasmine-node');

  // Default task.
  grunt.registerTask('default', ['jshint', 'jasmine_node']);

};
