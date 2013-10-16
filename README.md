![Build status](https://circleci.com/gh/youpers/yp-backend.png?circle-token=:circle-token)

The best project ever.

## Getting Started
- clone the repositoy from github
- install mongodb
- change into the new directory and run:

    npm install


## Documentation
### Build commands:

    grunt
tests, compiles and builds the distribution version of the whole project, is used by CI
is executing "grunt jshint", "grunt test"

    grunt server
for test driven development, watches all files, starts a server on localhost:8000 and restarts server when needed
Also reexecutes all tests as soon as a file changes. Test are executed on temporary server on localhost:3000

    node app.js
Run the server locally

## Continuous Deployment to Heroku:

CircleCI automatically deploys this project to Heroku whenever all Tests pass on the CircleCI Server.

Heroku uses:
- "ci" environmont (see config.js) for the master branch, deploys to http://yp-backend-ci.herokuapp.com
- "test" environment (see config.js) for the test branch, deploys to http://yp-backend-test.herokupp.com

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2013 RBLU  
Licensed under the MIT license.
