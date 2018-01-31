#!/bin/bash

adddate() {
    while IFS= read -r line; do
        echo "$(date +'%a %d %b %T') - $line"
    done
}

if [[ "${REDIS_MODE}" == "docker" ]]; then
  echo "Using linked docker redis"
else
  echo "Starting local redis"
  nohup redis-server --dir /home/audiogram/redis --appendonly yes --logfile redis.log &
fi
npm run debug | adddate &>> console.log