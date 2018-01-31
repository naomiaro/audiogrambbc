#!/bin/bash

adddate() {
    while IFS= read -r line; do
        echo "$(date +'%a %d %b %T') - $line"
    done
}

if [[ -z "${REDIS_PORT}" ]]; then
  echo "Starting local redis"
  nohup redis-server --dir /home/audiogram/redis --appendonly yes --logfile redis.log &
else
  echo "Using linked docker redis"
fi
npm run debug | adddate &>> console.log