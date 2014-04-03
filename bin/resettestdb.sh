#!/bin/bash
echo "**** RESETTING MONGO DATABASE localhost:test_database to dbdata/testset"
mongo test_database --eval "db.dropDatabase();"
bin/mongoimportexport.sh -d dbdata/testset -l test_database