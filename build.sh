#!/bin/sh

set -xe

BIN=bin
GO_SRC_FILE="cmd/main.go"
GO_BIN_FILE="${BIN}/main"

TS_ROOT="web/js"
TS_SRC_FILE="$TS_ROOT/script.ts"
TS_BIN_FILE="$TS_ROOT/script.js"

if [ ! -f "$GO_SRC_FILE" ]; then
  echo "Could not find .go source file $GO_SRC_FILE"
  exit 1
fi

if [ ! -f "$TS_SRC_FILE" ]; then
  echo "Could not find .ts source file $TS_SRC_FILE"
  exit 1
fi

build_go() {
  if [ -d "$BIN" ]; then
    rm -rf "$BIN"
  fi
  mkdir "$BIN"

  go build -o "$GO_BIN_FILE" "$GO_SRC_FILE" 
}

if [ ! -f "$GO_BIN_FILE" ]; then
  echo "Go binary does not exist. Building..."

  build_go
else
  SRC_MTIME=$(stat -c %Y "$GO_SRC_FILE")
  BIN_MTIME=$(stat -c %Y "$GO_BIN_FILE")

  if [ "$SRC_MTIME" -gt "$BIN_MTIME" ]; then
    echo "Go Source file newer than binary. Rebuilding..." 

    build_go
  else
    echo "Go Binary is up to date."
  fi
fi

build_ts() {
  if [ ! -d "node_modules" ]; then
    npm install -y
  fi

  node_modules/typescript/bin/tsc -b
}

if [ ! -f "$TS_BIN_FILE" ]; then
  echo "JS file does does not exist yet. Building..."

  build_ts
else
  SRC_MTIME=$(stat -c %Y "$TS_SRC_FILE")
  BIN_MTIME=$(stat -c %Y "$TS_BIN_FILE")

  if [ "$SRC_MTIME" -gt "$BIN_MTIME" ]; then
    echo "TS source file newer than JS file. Rebuilding..." 

    build_ts
  else
    echo "JS is up to date."
  fi
fi
