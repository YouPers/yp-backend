'use strict';

module.exports = function (grunt) {

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
                src: ['app.js', 'config/**/*.js', 'models/**/*.js', 'routes/**/*.js']
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib: {
                files: '<%= jshint.code.src %>',
                tasks: ['jshint:code', 'jasmine_node']
            },
            test: {
                files: 'spec/**/*spec.js',
                tasks: [ 'jasmine_node']
            }
        },
        jasmine_node: {
            specNameMatcher: "spec", // load only specs containing specNameMatcher
            projectRoot: ".",
            requirejs: false,
            autotest: false,
            forceExit: true,
            jUnit: {
                report: false,
                savePath: "./build/reports/jasmine/",
                useDotNotation: true,
                consolidate: true
            }
        },
        concurrent: {
            dev: {
                tasks: ['nodemon', 'watch'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        nodemon: {
            dev: {
                options: {
                    file: 'app.js',
                    nodeArgs: ['--debug'],
                    ignoredFiles: ['README.md', 'node_modules/**', 'spec/**', '.idea/**'],
                    delayTime: 1,
                    env: {
                        PORT: '8000'
                    }
                }
            }
        },
        wait: {
            options: {
                delay: 500
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-wait');

    // Default task.


    grunt.registerTask('default', ['jshint', 'jasmine_node']);
    grunt.registerTask('test', ['jshint', 'jasmine_node']);
    grunt.registerTask('server', ['jshint', 'jasmine_node','concurrent']);
};
