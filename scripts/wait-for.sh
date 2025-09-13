#!/usr/bin/env sh
# Simple wait-for script to block until a host:port is reachable
set -e

HOST="$1"
PORT="$2"

until nc -z "$HOST" "$PORT"; do
  echo "Waiting for $HOST:$PORT..."
  sleep 1
done

echo "$HOST:$PORT is up"
