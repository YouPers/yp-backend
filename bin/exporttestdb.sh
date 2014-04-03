#!/bin/bash
set -e
bin/mongoimportexport.sh -d dbdata/testset test_database
