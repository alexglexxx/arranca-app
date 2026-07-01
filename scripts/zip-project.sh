#!/bin/bash

set -e

PROJECT_DIR="/home/alexglex/arranca-app"
OUTPUT_DIR="/home/alexglex"
ZIP_NAME="arranca-app.zip"

echo "📦 Creando ZIP de $ZIP_NAME..."

cd "$PROJECT_DIR"

rm -f "$OUTPUT_DIR/$ZIP_NAME"

zip -rq "$OUTPUT_DIR/$ZIP_NAME" . \
    -x "node_modules/*" \
       ".next/*" \
       ".git/*" \
       "dist/*" \
       "coverage/*" \
       "*.log" \
       ".DS_Store"

echo ""
echo "✅ Listo"
echo "Archivo:"
ls -lh "$OUTPUT_DIR/$ZIP_NAME"
