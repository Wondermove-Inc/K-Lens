#!/bin/bash

set -euo pipefail

## macOS (Retina 최적화: 144 DPI)
rm -rf icon.iconset
mkdir icon.iconset
for i in 16 32 64 128 256 512 1024; do
  border=$((${i}000 * 100 / 1000000))
  size=$((i - 2 * border))
  half=$((i / 2))
  if [[ $i -ne 1024 ]]; then
    magick -background none icon.svg -density 400 -resize "${size}x${size}" -bordercolor transparent -border "${border}" -units PixelsPerInch -density 144 -verbose "icon.iconset/icon_${i}x${i}.png"
  fi
  if [[ $i -ne 16 ]]; then
    magick -background none icon.svg -density 400 -resize "${size}x${size}" -bordercolor transparent -border "${border}" -units PixelsPerInch -density 144 -verbose "icon.iconset/icon_${half}x${half}@2x.png"
  fi
done
iconutil --convert icns -o icon.icns icon.iconset
rm -rf icon.iconset

## Windows (Retina 최적화: 144 DPI)
magick -background none icon.svg -density 400 -define icon:auto-resize=256,16,20,24,32,40,48,60,64,72,80,96 -units PixelsPerInch -density 144 -verbose icon.ico

## Linux (Retina 최적화: 144 DPI)
for i in 16 22 24 32 36 48 64 72 96 128 192 256 512; do
  border=$((${i}000 * 38 / 1000000))
  size=$((i - 2 * border))
  magick -background none icon.svg -density 400 -resize "${size}x${size}" -bordercolor transparent -border "${border}" -units PixelsPerInch -density 144 -verbose "icons/${i}x${i}.png"
done
