#!/bin/bash

# Nuubi Load Test Monitor Script
# This script monitors Node.js CPU usage and Redis performance in real-time.

echo "🚀 Starting Nuubi Load Test Monitor..."
echo "------------------------------------------------"
printf "%-20s | %-10s | %-15s | %-10s\n" "Timestamp" "Node CPU%" "Redis Ops/sec" "Redis Conn"
echo "------------------------------------------------"

while true; do
    # 1. Get Node.js CPU usage (sum of all node processes)
    # Using 'ps' to get CPU and 'awk' to sum it up
    NODE_CPU=$(ps aux | grep 'node' | grep -v 'grep' | awk '{sum+=$3} END {print sum}')
    if [ -z "$NODE_CPU" ]; then NODE_CPU="0.0"; fi

    # 2. Get Redis Stats
    # Extracting instantaneous_ops_per_sec and connected_clients
    REDIS_STATS=$(redis-cli info stats)
    REDIS_CLIENTS=$(redis-cli info clients)
    
    OPS=$(echo "$REDIS_STATS" | grep 'instantaneous_ops_per_sec' | cut -d':' -f2 | tr -d '\r')
    CONNS=$(echo "$REDIS_CLIENTS" | grep 'connected_clients' | cut -d':' -f2 | tr -d '\r')

    # 3. Print formatted output
    TIMESTAMP=$(date +"%H:%M:%S")
    printf "%-20s | %-10s | %-15s | %-10s\n" "$TIMESTAMP" "$NODE_CPU%" "$OPS" "$CONNS"

    sleep 1
done
