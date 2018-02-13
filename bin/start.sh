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

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
curl --noproxy '*' -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" -d "{ \"what\": \"Audiogram - start\", \"tags\": [\"audiogram\", \"start\"], \"data\": \"[SERVICE STARTED] v$PACKAGE_VERSION\" }" 'http://audiogram.newslabs.co:8081/events/'

npm run debug | adddate &>> console.log
