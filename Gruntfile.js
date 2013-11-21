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
            test: {
                files: 'spec/**/*spec.js',
                tasks: [ 'jasmine_node']
            },
            express: {
                files:  [ 'app.js', 'routes/**/*.js', 'models/**/*.js', 'config/**/*.js'],
                tasks:  [ 'express:dev' ],
                options: {
                    nospawn: true //Without this option specified express won't be reloaded
                }
            }
        },
        jasmine_node: {
            specNameMatcher: "spec", // load only specs containing specNameMatcher
            projectRoot: ".",
            requirejs: false,
            autotest: true,
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
                tasks: ['nodemon', 'jasmine_node'],
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
                    ignoredFiles: ['README.md', 'node_modules/**', 'spec/**', '.idea/**', '.git/**', 'logs/**'],
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
        },
        express: {
            options: {
                // Override defaults here
            },
            dev: {
                options: {
                    script: './app.js',
                    delay: 5000
                }
            },
            prod: {
                options: {
                    script: 'path/to/prod/server.js',
                    node_env: 'production'
                }
            },
            test: {
                options: {
                    script: 'path/to/test/server.js'
                }
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-wait');
    grunt.loadNpmTasks('grunt-express-server');

    // Default task.
    grunt.registerTask('default', ['jshint', 'jasmine_node']);
    grunt.registerTask('test', ['jshint', 'express:dev', 'jasmine_node']);
    grunt.registerTask('server', ['jshint','nodemon']);
    grunt.registerTask('servertest', ['express:dev', 'jasmine_node', 'watch']);
};