.PHONY: default watch run build

default: build

build:
	npm run build

watch:
	npm run watch

run:
	web-ext run -t chromium --chromium-profile ~/.config/chromium/Default
