#!/bin/env python

from flask import Flask, request, jsonify, json
import csv

# Output file
DATA_OUT = 'data.csv'
# Host and port of the API server
HOST = 'localhost'
PORT = 8082

# Shared variables
api = Flask(__name__)
csvfile = None
csvwriter = None

@api.route('/collect', methods=['POST'])
def post_collect():
    # Extract data
    data = request.get_json()

    if not 'uri' in data or not 'status' or not 'result' in data:
        print('Invalid request: missing uri, status or result')
        return jsonify(success=False), 400

    uri = data['uri']
    status = data['status']
    result = data['result']

    if status == 0:
        print(f'{uri}: ✅ no manipulation detected')
    elif status == 1:
        print(f'{uri}: ⚠️  potential manipulation detected')
    elif status == 2:
        print(f'{uri}: ℹ️  polyfill detected: {json.dumps(result)}')
    elif status == 3:
        print(f'{uri}: ℹ️  stack trace: {json.dumps(result)}')
    elif status < 0:
        print(f'{uri}: ⚠️  error: {json.dumps(result)}')
    else:
        print(f'{uri}: ⚠️  unknown status: {status}')

    # Append result
    csvwriter.writerow([uri, status, json.dumps(result)])
    csvfile.flush()

    return jsonify(success=True), 200

if __name__ == '__main__':
    with open(DATA_OUT, 'a') as file:
        csvfile = file
        csvwriter = csv.writer(csvfile)

        # Write header if file is empty
        if file.tell() == 0:
            csvwriter.writerow(['uri', 'status', 'data'])
            file.flush()
        
        api.run(host=HOST, port=PORT, debug=False)
