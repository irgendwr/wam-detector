#!/bin/env python

import time
import asyncio
import argparse
import requests
import random
from sys import argv, exit
from math import floor
from multiprocessing import cpu_count
from tranco import Tranco
from playwright.async_api import async_playwright, BrowserContext

# Path to the extension
PATH_TO_EXTENSION = "<enter your path here>/wam-detector/distribution"
USER_DATA_DIR = "/tmp/test-user-data-dir"
COLLECTOR_API = "http://localhost:8082/collect"

TRANCO_LIST_DATE = '2022-05-03'

# These values are configured via command line flags.
LIST_OFFSET = 0
NUM_DOMAINS = 0
BATCH_SIZE = cpu_count()*2

# Playwright action timeout in ms
ACTION_TIMEOUT = 75 * 1000
# Fallback timeout in seconds
FALLBACK_TIMEOUT = 90.0
# Time to wait after page finished loading in seconds
PAGE_SLEEP = 5.0

# List of domains that should not be processed.
blocklist = ['pootin.dog']


# Process a domain.
async def process_domain(context: BrowserContext, domain: str, pos: int):
    # Skip domains in the blocklist.
    if domain in blocklist:
        print(f'[{pos}] ⚠️ Skipped blocked domain: {domain}')
        return

    # Sleep a short random time to distribute the load more evenly
    await asyncio.sleep(random.uniform(0.0, 1.5))

    # Open a new tab
    page = await context.new_page()
    page.set_default_timeout(ACTION_TIMEOUT)

    # Try to navigate to www subdomain
    uri = f'http://www.{domain}/'
    try:
        await asyncio.wait_for(page.goto(uri), timeout=FALLBACK_TIMEOUT)
        # Wait for page to finish loading + additional sleep time
        await asyncio.sleep(PAGE_SLEEP)
    # As a fallback, try navigating to the domain without "www."
    except Exception as e:
        print(f'[{pos}] ⚠️ Error/Timeout while processing {uri}: {e}')
        sendToCollector({
            'uri': uri,
            'status': -1,
            'result': {
                'error': 'timeout in process_domain',
                'uri': uri,
                'pos': pos,
                'list': TRANCO_LIST_DATE,
            }
        })

        # Wait a bit before trying again
        await asyncio.sleep(0.5)

        # try without 'www'
        uri = f'http://{domain}/'
        try:
            await asyncio.wait_for(page.goto(uri), timeout=FALLBACK_TIMEOUT)
            # print(await page.title())
            await asyncio.sleep(PAGE_SLEEP)
        except Exception as e:
            print(f'[{pos}] ⚠️ Error/Timeout while processing {uri}: {e}')
            sendToCollector({
                'uri': uri,
                'status': -2,
                'result': {
                    'error': 'timeout in process_domain',
                    'uri': uri,
                    'pos': pos,
                    'list': TRANCO_LIST_DATE,
                }
            })
    try:
        await asyncio.wait_for(page.close(), timeout=PAGE_SLEEP)
    except Exception as e:
        print(f'[{pos}] unable to close: {domain}')
    print(f'[{pos}] done: {domain}')

# Process a batch of domains
async def process_batch(context: BrowserContext, list: list[str], start: int, end: int):
    try:
        await asyncio.gather(
            *[process_domain(context, list[pos], pos) for pos in range(start, end)]
        )
    except Exception as e:
        print(f'[{start}:{end}] ⚠️ Timeout or error in process_batch: {e}')
        sendToCollector({
            'uri': f'internal:///List({TRANCO_LIST_DATE})[{start}:{end}]',
            'status': -9,
            'result': {
                'error': e,
                'start': start,
                'end': end,
                'list': TRANCO_LIST_DATE,
            }
        })


# Send data to the data collection script.
def sendToCollector(payload):
    try:
        requests.post(COLLECTOR_API, json=payload)
    except Exception as e:
        print(f'⚠️ Unable to send data to collector: {e}')


# Main initialization and loop.
async def main(args):
    # Get list of domains from https://tranco-list.eu/
    tranco = Tranco(cache=True, cache_dir='.tranco')
    list = tranco.list(date=TRANCO_LIST_DATE).list

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            USER_DATA_DIR,
            headless=False,
            args=[
                f"--disable-extensions-except={PATH_TO_EXTENSION}",
                f"--load-extension={PATH_TO_EXTENSION}",
                "--no-experiments",
                "--no-pings",
                "--no-default-browser-check"
            ],
        )

        if args.pause:
            input("Press enter to start.")

        totalDomains = NUM_DOMAINS - LIST_OFFSET
        batches = floor(totalDomains/BATCH_SIZE)
        for i in range(batches):
            print(f'starting batch {i}...')
            start = LIST_OFFSET + i*BATCH_SIZE
            end = start + BATCH_SIZE

            await process_batch(context, list, start, end)

        rest = totalDomains - batches*BATCH_SIZE
        if rest:
            await process_batch(context, list, NUM_DOMAINS-rest, NUM_DOMAINS)

        try:
            await asyncio.wait_for(context.close(), timeout=FALLBACK_TIMEOUT)
        except Exception as e:
            exit('Unclean shutdown')

if __name__ == "__main__":

    # Parse arguments
    parser = argparse.ArgumentParser()
    parser.add_argument('-s', '--start', help="start list position", type=int, default=0)
    parser.add_argument('-e', '--end', help="end list position", type=int, default=0)
    parser.add_argument('-b', '--batchsize', help="batch size", type=int, default=cpu_count()*2)
    parser.add_argument('-p', '--pause', action=argparse.BooleanOptionalAction, default=False)
    args = parser.parse_args()

    # Overwrite values
    LIST_OFFSET = args.start
    NUM_DOMAINS = args.end
    BATCH_SIZE = args.batchsize

    # Measure execution time and run main loop
    start = time.time()
    asyncio.run(main(args))
    totaltime = floor(time.time() - start)
    totalDomains = NUM_DOMAINS - LIST_OFFSET
    print(f'Took {totaltime} seconds to process {totalDomains} domains in batches of {BATCH_SIZE}.')
