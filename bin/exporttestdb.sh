#!/bin/bash
set -e
OLD_VERSION=`mongo --version | cut -b 24-
brew switch mongo 2.4.9
bin/mongoimportexport.sh -d dbdata/testset test_database
brew switch mongo $OLD_VERSION