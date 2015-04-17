#!/bin/bash
set -e
DB=$1

if [ -z "$DB" ]; then
    DB="test_database"
fi

ARGS="-l $DB"

if [ -z "$2" ]
then
    ARGS="$ARGS"
else
    ARGS="-u $2 -p $3 $ARGS"
    USERARGS="-u $2 -p $3"
fi

echo "**** RESETTING MONGO DATABASE localhost:$DB to dbdata/testset and dbdata/content"
mongo $DB $USERARGS --eval "db.getCollectionNames().forEach(function(c) { if (c.indexOf('system.') == -1) db[c].remove({}); })"
bin/mongoimportexport.sh -d dbdata/testset $ARGS
bin/mongoimportexport.sh -d dbdata/content $ARGS