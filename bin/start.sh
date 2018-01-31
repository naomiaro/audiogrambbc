#!/bin/bash
if [[ -z "${REDIS_PORT}" ]]; then
  echo "Starting local redis"
  nohup redis-server --dir /home/audiogram/redis --appendonly yes --logfile redis.log &
else
  echo "Using linked docker redis"
fi