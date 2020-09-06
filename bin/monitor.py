#!/usr/bin/env python3
import time
import os
from statsd import StatsClient
import redis
from rq import Connection, Queue


REDIS_URL = os.environ.get("REDASH_REDIS_URL", "redis://localhost:6379/0")
STATSD_HOST = os.environ.get("REDASH_STATSD_HOST", "127.0.0.1")
STATSD_PORT = int(os.environ.get("REDASH_STATSD_PORT", "8125"))
STATSD_PREFIX = os.environ.get("REDASH_STATSD_PREFIX", "redash")

redis_connection = redis.from_url(REDIS_URL)
statsd_client = StatsClient(host=STATSD_HOST, port=STATSD_PORT, prefix=STATSD_PREFIX)

if __name__ == "__main__":
    with Connection(redis_connection):
        while True:
            for queue in Queue.all():
                statsd_client.gauge(f"rq.queue.{queue.name}.waiting", len(queue))

            statsd_client.gauge(
                "query_locks", len(redis_connection.keys("query_hash_job:*"))
            )

            time.sleep(5)

