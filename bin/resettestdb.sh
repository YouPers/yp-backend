#!/bin/bash
set -e
DB=$1

if [ -z "$DB" ]; then
    DB="test_database"
fi

echo "**** RESETTING MONGO DATABASE localhost:$DB to dbdata/testset and dbdata/content"
mongo $DB --eval "db.dropDatabase();"
bin/mongoimportexport.sh -d dbdata/testset -l $DB
bin/mongoimportexport.sh -d dbdata/content -l $DB