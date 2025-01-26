#!/bin/sh

BIN=bin

set -xe

if [ -d "$BIN" ]; then
  rm -rf "$BIN"
fi

mkdir "$BIN"
go build -o ${BIN}/main cmd/main.go 

if [ ! -d "node_modules" ]; then
  npm install -y
fi

node_modules/typescript/bin/tsc -b
