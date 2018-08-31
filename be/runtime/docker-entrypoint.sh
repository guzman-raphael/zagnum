#!/usr/bin/env sh

for filename in /common/*.txt; do

  FILE_SIZE=$(wc -c < $filename)

  if [ "$FILE_SIZE" -eq "0" ] || [ $(cat $filename) == "$HOSTNAME" ]; then
    echo $HOSTNAME > $filename
    DB_NAME=$(basename $filename)
    export DB=${DB_NAME%.txt}
    break;
  fi

done

sleep 5

npm $1
# RG
