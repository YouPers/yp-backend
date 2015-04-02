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
    echo $2
    echo $3
    ARGS="-d dbdata/content -u $2 -p $3 $ARGS"
    echo $ARGS
fi

echo "**** importing Content Collections into MONGO DATABASE localhost:$DB from dbdata/content"
echo "bin/mongoimportexport.sh $ARGS"
bin/mongoimportexport.sh $ARGS