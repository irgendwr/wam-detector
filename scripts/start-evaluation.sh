#!/bin/bash

# Define the range of domains to process
START=0
TOTAL=16000
STEP=500

# Root directory of this script
root=`dirname "$0"`

# Allow configuring browser settings
"$root/auto-evaluator.py" --pause

# Loop
last=$START
for ((i = $START+$STEP ; i <= $TOTAL ; i+=$STEP)); do
    echo "processing [$last,$i]"
    "$root/auto-evaluator.py" -s "$last" -e "$i"
    last=$i
done
