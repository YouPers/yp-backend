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
                files: [ 'app.js', 'routes/**/*.js', 'models/**/*.js', 'config/**/*.js', 'logic/**/".js'],
                tasks: [ 'express:dev' ],
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
                    ignoredFiles: ['README.md', 'node_modules/**', 'spec/**', '.idea/**', '.git/**',
                        'logs/**', 'atlassian-ide-plugin.xml', 'locales*/**'],
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
                    port: 8000,
                    script: './app.js',
                    delay: 5000,
                    output: null  // is needed, otherwise delay is ignored after any server output to System.out

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
        },
        curl: {
            apidoclist: {
                src: 'http://localhost:8000/api-docs',
                dest: 'dist/api-docs/resources.json'
            }
        },
        'curl-dir': {
            apidocfiles: {
                src: '',
                router: function (url) {
                    return url.split('/')[4] ;
                },
                dest: 'dist/api-docs'
            }
        }
    });


    grunt.registerTask('apidoc', 'downloads apidoc to dist/apidoc', function () {
        grunt.task.requires('curl:apidoclist');

        var resourceList = grunt.file.readJSON('dist/api-docs/resources.json');
        var srcPaths = [];
        grunt.log.writeln(JSON.stringify(resourceList));
        grunt.log.writeln(resourceList.apis.length);
        for (var i = 0; i < resourceList.apis.length; i++) {
            grunt.log.writeln(resourceList.basePath + resourceList.apis[i].path);
            srcPaths.push(resourceList.basePath + resourceList.apis[i].path);
        }
        grunt.log.writeln(JSON.stringify(srcPaths));
        grunt.config.set('curl-dir.apidocfiles.src', srcPaths);
        grunt.task.run('curl-dir:apidocfiles');
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-wait');
    grunt.loadNpmTasks('grunt-express-server');
    grunt.loadNpmTasks('grunt-curl');

    // Default task.
    grunt.registerTask('default', ['jshint', 'jasmine_node']);
    grunt.registerTask('test', ['jshint', 'express:dev', 'jasmine_node']);
    grunt.registerTask('testdebug', ['jshint', 'jasmine_node']);
    grunt.registerTask('server', ['jshint', 'nodemon']);
    grunt.registerTask('servertest', ['express:dev', 'jasmine_node', 'watch']);
    grunt.registerTask('pushapidoc', ['express:dev', 'curl:apidoclist','apidoc']);
};