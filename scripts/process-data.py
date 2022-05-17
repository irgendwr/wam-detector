#!/bin/env python

import csv
import time
import ctypes
import json
import re
import argparse
from os import path
from typing import Optional
from math import floor
from tranco import Tranco
from urllib.parse import urlparse
from tld import get_fld

# Tranco list date
TRANCO_LIST_DATE = '2022-05-03'

# Total number of domains
NUM_DOMAINS = 16000

# Data file generated by "data-collector.py"
DATA_BASENAME = "data"
DATA_IN = DATA_BASENAME+".csv"

# Files generated by this script
DATA_OUT = DATA_BASENAME+"_processed.csv"
DATA_OUT_PDS = DATA_BASENAME+"_pds.csv"
DATA_OUT_MDS = DATA_BASENAME+"_mds.csv"
DATA_OUT_RK = DATA_BASENAME+"_rk.csv"
DATA_OUT_FK = DATA_BASENAME+"_fk.csv"

# Stack Trace RegEx
RE_TRACE = r"at (?:[\w.]+ \()?(https?:\/\/+[^\/\s:]+)"

# debug variables
matches_1 = 0
matches_2 = 0
non_matches = 0


class ResultItem():
    def __init__(self, rank, domain):
        # Rank of the domain in the lis
        self.rank: int = rank
        # Domain
        self.domain: str = domain
        # Status (error: < 0, unmodified: 0, modified: 1)
        self.status: int = -1
        # Was an external polyfill library included?
        self.external_polyfill: bool = False
        # Did an external script modify an API?
        self.external_manipulation: bool = False
        # Did the page redirect to HTTPS?
        self.https: bool = False
        # Domains of external polyfill libraries
        self.polyfill_domains: set[str] = set()
        # Domains that served scripts which modified an API
        self.manipulation_domains: set[str] = set()
        # Keys modifie mapped to domain
        self.manipulation_keymap: dict = {}
        # Keys that failed the reference verification
        self.refMissmatches: set[str] = set()
        # Functions that failed the verification
        self.funcMissmatches: set[str] = set()
        # Flags
        self.flags: set[str] = set()

    def encode(self):
        return (
            self.rank,
            self.domain,
            self.status,
            self.external_polyfill,
            self.external_manipulation,
            self.https,
            json.dumps(list(self.polyfill_domains)),
            json.dumps(list(self.manipulation_domains)),
        )

# store the results
results: list[ResultItem] = []

# Returns the eSLD of a URL.
def get_eSLD(url: str) -> str:
    try:
        # Use the public-suffix list to get the eSLD of a domain
        return get_fld(url, fix_protocol=True)
    except Exception as e:
        try:
            # Fallback #1: return hostname
            return urlparse(url).hostname
        except Exception as e:
            # Fallback #2: return URL
            return url

# Returns the position of a hostname in a given list.
def getPos(list: list[str], hostname: Optional[str]) -> int:
    global matches_1
    global matches_2
    global non_matches

    # Ignore invalid URLs
    if hostname == None:
        return -1

    eSLD = get_eSLD(hostname)

    # Look for direct matches or matches without the 'www.' prefix
    matches = [pos for pos in range(NUM_DOMAINS) if list[pos] == hostname or list[pos] == eSLD]
    if len(matches) != 0:
        #print(f"Matched#1 '{hostname}' to '{list[matches[0]]}' at pos {matches[0]}")
        matches_1 += 1
        return matches[0]

    # Check if the hostname is a subdomain
    matches = [pos for pos in range(NUM_DOMAINS) if hostname.endswith("." + list[pos])]
    if len(matches) != 0:
        #print(f"Matched#2 '{hostname}' to '{list[matches[0]]}' at pos {matches[0]}")
        matches_2 += 1
        return matches[0]

    # No match
    #print(f"Unable to find the position of hostname: {hostname}")
    non_matches += 1
    return -1

def percentof(value: int, total: int) -> float:
    return round(value/total * 100, 2)

def processData(pos: int, data: str):
    d = json.loads(data)

    # Add keys to set
    for key in d['refMissmatches']:
        results[pos].refMissmatches.add(key)

    # Add keys to set
    for item in d['funcMissmatches']:
        results[pos].funcMissmatches.add(".".join(item['keys']))

    # Add flags to set
    for flag in d['flags']:
        results[pos].flags.add(flag)

# Returns whether a is not part of the domain b
def isExternalDomain(a: str, b: str) -> bool:
    return a != b and not a.endswith("."+b)

# Returns a set of domains included in the stack trace
def extractDomainsFromTrace(trace: str) -> set[str]:
    lines = trace.split("\n")
    
    if len(lines) < 3:
        return []
    
    domains = set()
    for line in lines[2:]:
        # Extract domain from line and add it to the set
        matches = re.search(RE_TRACE, line)
        if matches:
            domains.add(matches.groups(1)[0])
    
    return domains

def processStackTraceData(pos: int, data: str):
    d = json.loads(data)

    # Extract domains
    domains = extractDomainsFromTrace(d['stack'])

    # Return if no domains found
    if len(domains) == 0:
        return

    # Add domains to item
    for domain in domains:
        # Remove scheme
        #noprefixdomain = domain.removeprefix("https://").removeprefix("http://")
        # Get effective SLD
        eSLD = get_eSLD(domain)

        if isExternalDomain(eSLD, results[pos].domain):
            results[pos].manipulation_domains.add(eSLD)
            results[pos].external_manipulation = True

    # Add keys to keymap
    for key in d['keys']:
        results[pos].manipulation_keymap[key] = domain[0]

def main(args):
    # Get list of domains from https://tranco-list.eu/
    tranco = Tranco(cache=True, cache_dir='.tranco')
    trancolist = tranco.list(date=TRANCO_LIST_DATE).list

    # Initialize result list
    for pos in range(NUM_DOMAINS):
        results.append(ResultItem(pos+1, trancolist[pos]))

    # Increase the CSV field size limit
    # https://stackoverflow.com/a/54517228/4884643
    csv.field_size_limit(int(ctypes.c_ulong(-1).value // 2))

    with open(DATA_IN, 'r') as file_in:
        csvreader = csv.reader(file_in)

        # Skip header
        next(csvreader, None)

        # Iterate over rows
        for (url, status_str, data) in csvreader:
            status = int(status_str)
            #print(url, status)

            urlobj = urlparse(url)
            pos = getPos(trancolist, urlobj.hostname)

            # Skip URLs that are not in the list.
            if pos == -1:
                continue
            
            # Store if the connection used HTTPS at some point.
            if urlobj.scheme == "https":
                results[pos].https = True
            
            # Process result
            if status == 1:
                processData(pos, data)
            # Store if an external polyfill library was detected
            elif status == 2:
                decoded = json.loads(data)
                polyfill = decoded['polyfill']
                #polyfillhost = urlparse(polyfill).hostname
                eSLD = get_eSLD(polyfill)

                if (eSLD != urlobj.hostname
                    and isExternalDomain(eSLD, results[pos].domain)):

                    results[pos].external_polyfill = True
                    results[pos].polyfill_domains.add(eSLD)
            # Store the origin of the code responsible for manipulation
            elif status == 3:
                processStackTraceData(pos, data)
            # Store the highest status
            elif status > 2:
                print(f"Error: unknown status {status} for {url}")
            
            # Store the highest status smaller than 2
            if status < 2 and results[pos].status < status:
                results[pos].status = status
            
            #if status > 0 and data != "":
            #    results[pos].data.append(data)

    # Counter variables
    count_failed = 0
    count_unmodified = 0
    count_modified = 0
    count_external_polyfill = 0
    count_external_manipulation = 0
    count_https = 0
    count_corejs = 0

    polyfilldomain_counter = {}
    polyfilldomain_usedby = {}

    external_counter = {}
    external_targets = {}

    refKeyCounter = {}
    funcKeyCounter = {}
    flagCounter = {}

    # Open output files
    with open(DATA_OUT, 'w') as file_out, \
         open(DATA_OUT_PDS, 'w') as file_out_pds, \
         open(DATA_OUT_MDS, 'w') as file_out_mds, \
         open(DATA_OUT_RK, 'w') as file_out_rk, \
         open(DATA_OUT_FK, 'w') as file_out_fk:
        # Open CSV writers
        csvwriter = csv.writer(file_out)
        csvwriter_pds = csv.writer(file_out_pds)
        csvwriter_mds = csv.writer(file_out_mds)
        csvwriter_rk = csv.writer(file_out_rk)
        csvwriter_fk = csv.writer(file_out_fk)

        # Write headers
        csvwriter.writerow(['rank', 'domain', 'status', 'external_polyfill', 'external_manipulation', 'https', 'polyfill_domains', 'manipulation_domains'])
        csvwriter_pds.writerow(['count', 'percent', 'domain', 'used_by'])
        csvwriter_mds.writerow(['count', 'percent', 'domain', 'target_domain'])
        csvwriter_rk.writerow(['count', 'percent', 'key'])
        csvwriter_fk.writerow(['count', 'percent', 'key'])

        for result in results:
            csvwriter.writerow(result.encode())

            # Increase counter corresponding to the status
            if result.status == -1:
                count_failed += 1
                continue
            elif result.status == 0:
                count_unmodified += 1
            elif result.status == 1:
                count_modified += 1
            else:
                print(f"Error: invalid result for {result.domain}")

            # Process the rest of the result properties

            if result.external_polyfill:
                count_external_polyfill += 1

                for pd in result.polyfill_domains:
                    # increment counter of the polyfill domain
                    polyfilldomain_counter[pd] = polyfilldomain_counter.get(pd, 0) + 1
                    polyfilldomain_usedby[pd] = polyfilldomain_usedby.get(pd, []) + [result.domain]

            if result.external_manipulation:
                count_external_manipulation += 1

            if "core-js" in result.flags:
                count_corejs += 1

            for md in result.manipulation_domains:
                # increment counter of the polyfill domain
                external_counter[md] = external_counter.get(md, 0) + 1
                external_targets[md] = external_targets.get(md, []) + [result.domain]

            for key in result.refMissmatches:
                refKeyCounter[key] = refKeyCounter.get(key, 0) + 1

            for key in result.funcMissmatches:
                funcKeyCounter[key] = funcKeyCounter.get(key, 0) + 1

            for flag in result.flags:
                flagCounter[flag] = flagCounter.get(flag, 0) + 1

            # Increase https counter if flag is set
            if result.https:
                count_https += 1

        total_processed = count_unmodified+count_modified

        # Process the external polyfills
        sorted_pdc = dict(sorted(polyfilldomain_counter.items(), key=lambda item: item[1], reverse=True))
        for domain, count in sorted_pdc.items():
            csvwriter_pds.writerow([count, percentof(count, total_processed), domain, json.dumps(polyfilldomain_usedby[domain])])
        
        # Process the external modification domains
        sorted_mdc = dict(sorted(external_counter.items(), key=lambda item: item[1], reverse=True))
        for domain, count in sorted_mdc.items():
            csvwriter_mds.writerow([count, percentof(count, total_processed), domain, json.dumps(external_targets[domain])])
        
        # Process reference verification missmatches
        sorted_rkc = dict(sorted(refKeyCounter.items(), key=lambda item: item[1], reverse=True))
        for key, count in sorted_rkc.items():
            csvwriter_rk.writerow([count, percentof(count, total_processed), key])
        
        # Process function verification failures
        sorted_fkc = dict(sorted(funcKeyCounter.items(), key=lambda item: item[1], reverse=True))
        for key, count in sorted_fkc.items():
            csvwriter_fk.writerow([count, percentof(count, total_processed), key])
    
    success = percentof(total_processed, NUM_DOMAINS)
    print(f"Successfully gathered data from {total_processed} of {NUM_DOMAINS} domains. ({success:.2f}% success, {100-success:.2f}% failed)\n")

    print(f"Unmodified: {count_unmodified} ({percentof(count_unmodified, total_processed):.2f}%)")
    print(f"Modified: {count_modified} ({percentof(count_modified, total_processed):.2f}%)")
    print(f"HTTPS: {count_https} ({percentof(count_https, total_processed):.2f}%) - used HTTPS at least once")
    print(f"core-js detected: {count_corejs} ({percentof(count_corejs, total_processed):.2f}%)")
    print(f"External Polyfill: {count_external_polyfill} ({percentof(count_external_polyfill, total_processed):.2f}%)")
    print(f"External Modification: {count_external_manipulation} ({percentof(count_external_manipulation, total_processed):.2f}%)")
    print("")
    print(f"Generated the following files: {DATA_OUT} {DATA_OUT_PDS} {DATA_OUT_MDS} {DATA_OUT_RK} {DATA_OUT_FK}")


if __name__ == "__main__":

    # Parse arguments
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', help="data input file", type=str, default=DATA_IN)
    parser.add_argument('-o', '--output', help="output file basename", type=str)
    parser.add_argument('-n', '--num', help="Total number of domains", type=int, default=NUM_DOMAINS)
    args = parser.parse_args()

    DATA_IN = args.input
    DATA_BASENAME = args.output
    if not DATA_BASENAME:
        DATA_BASENAME = path.splitext(DATA_IN)[0]
    NUM_DOMAINS = args.num

    # Files generated by this script
    DATA_OUT = DATA_BASENAME+"_processed.csv"
    DATA_OUT_PDS = DATA_BASENAME+"_pds.csv"
    DATA_OUT_MDS = DATA_BASENAME+"_mds.csv"
    DATA_OUT_RK = DATA_BASENAME+"_rk.csv"
    DATA_OUT_FK = DATA_BASENAME+"_fk.csv"

    start = time.time()
    main(args)
    totaltime = floor(time.time() - start)
    print("")
    print(f'Debug: {non_matches} URLs could not be matched.')
    print(f'Took {totaltime} seconds.')
