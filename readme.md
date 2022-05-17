# WAM Detector

## Features

This browser extension detects "Client-Side Web API Manipulations".

## Demo Pages

The `examples/` directory contains demo HTML pages that allow testing the browser extension:

- `index.html` - Index with list of pages
- `safe.html` - Does not modify browser APIs
- `fetch-manipulation.html` - Modifies the `fetch` browser API
- `property-manipulation.html` - Modifies `console` logging APIs
- `external-polyfill.html` - Includes an external polyfill library that overrides browser APIs

## Development

### Build locally

1. Checkout the copied repository to your local machine eg. with `git clone https://github.com/irgendwr/wam-detector.git`
2. run `npm install` to install all required dependencies
3. run `npm run build`

The build step will create the `distribution` folder, this folder will contain the generated extension.

### Run the extension

Using [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) is recommended for automatic reloading and running in a dedicated browser instance. Alternatively you can load the extension manually (see below).

1. run `npm run watch` to watch for file changes and build continuously
2. run `npm install --global web-ext` (only only for the first time)
3. in another terminal, run `web-ext run` for Firefox or `web-ext run -t chromium`
4. Check that the extension is loaded by opening the extension options ([in Firefox](media/extension_options_firefox.png) or [in Chrome](media/extension_options_chrome.png)).

#### Manually

You can also [load the extension manually in Chrome](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#google-chrome-opera-vivaldi) or [Firefox](https://www.smashingmagazine.com/2017/04/browser-extension-edge-chrome-firefox-opera-brave-vivaldi/#mozilla-firefox).

#### Debugging in Firefox

- Visit [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)
- Click 'Inspect' on the extension
- Open the console or debugger

## Scripts

This repository also contains scripts that allow the collection and evaluation of data generated by the extension.

Scripts in `scripts/`:
- `data-collector.py` - REST API that receives data from the browser extension
- `start-evaluation.sh` - BASH script that starts the evaluation / runs `auto-evaluator.py`
- `auto-evaluator.py` - Script that automates the browser and visits domains from the tranco list
- `process-data.py` - Script that processes the gathered data and generates statistics

### Running the scripts

Install requirements: `pip install -r scripts/requirements.txt`

Edit the constants at the top of the script files to fit your setup.

Start the scripts:

1. Data collection

    ```sh
    ./scripts/data-collector.py
    ```

2. Start evaluation

    ```sh
    ./scripts/start-evaluation.sh
    ```

3. Process data

    ```sh
    ./scripts/process-data.py
    ```

## Credits

- Based on the [browser extension template](https://github.com/fregante/browser-extension-template) by [@fregante](https://github.com/fregante).
- Icons created by [@HansiMcKlaus](https://github.com/HansiMcKlaus/)

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/).
