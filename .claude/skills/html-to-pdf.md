---
name: html-to-pdf
description: Use when converting HTML files to PDF format on macOS
---

# HTML to PDF Converter (macOS)

## Overview
Convert HTML files to PDF format using various methods available on macOS.

## Available Methods

### Method 1: Chrome/Chromium Headless (Best Quality)
Uses Chrome's built-in PDF engine for high-quality conversion.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --print-to-pdf="$OUTPUT_PATH" \
  "$INPUT_PATH"
```

**Advantages:**
- Best rendering quality
- Preserves CSS, fonts, and colors
- Handles modern web features
- No additional installation needed if Chrome is installed

**Parameters:**
- `--print-to-pdf=no-header`: Remove default header/footer
- `--virtual-time-budget=5000`: Set page load timeout (ms)

### Method 2: wkhtmltopdf (Command Line Tool)
Professional-grade HTML to PDF converter.

```bash
brew install wkhtmltopdf

wkhtmltopdf \
  --page-size A4 \
  --orientation Portrait \
  --margin-top 0 \
  --margin-bottom 0 \
  --margin-left 0 \
  --margin-right 0 \
  --enable-local-file-access \
  "$INPUT_PATH" \
  "$OUTPUT_PATH"
```

**Advantages:**
- Dedicated tool for HTML to PDF
- More control over page settings
- Good for batch processing

### Method 3: Python with WeasyPrint
Python library for HTML to PDF conversion.

```bash
pip3 install weasyprint

python3 -c "
from weasyprint import HTML
HTML('$INPUT_PATH').write_pdf('$OUTPUT_PATH')
"
```

**Advantages:**
- Python native
- Good CSS support
- Programmable

## Implementation Script

### Universal Converter Script
```bash
#!/bin/bash

# Convert HTML to PDF using available method
convert_html_to_pdf() {
    local input_path="$1"
    local output_path="${2:-${input_path%.html}.pdf}"

    # Method 1: Try Chrome headless first
    if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
        echo "Using Chrome headless..."
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
          --headless \
          --disable-gpu \
          --print-to-pdf="$output_path" \
          "$input_path"
        return 0
    fi

    # Method 2: Try Chromium
    if [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
        echo "Using Chromium headless..."
        "/Applications/Chromium.app/Contents/MacOS/Chromium" \
          --headless \
          --disable-gpu \
          --print-to-pdf="$output_path" \
          "$input_path"
        return 0
    fi

    # Method 3: Try wkhtmltopdf
    if command -v wkhtmltopdf &> /dev/null; then
        echo "Using wkhtmltopdf..."
        wkhtmltopdf \
          --page-size A4 \
          --orientation Portrait \
          --margin-top 0 \
          --margin-bottom 0 \
          --margin-left 0 \
          --margin-right 0 \
          --enable-local-file-access \
          "$input_path" \
          "$output_path"
        return 0
    fi

    # Method 4: Try Python WeasyPrint
    if python3 -c "import weasyprint" 2>/dev/null; then
        echo "Using Python WeasyPrint..."
        python3 -c "
from weasyprint import HTML
HTML('$input_path').write_pdf('$output_path')
"
        return 0
    fi

    echo "Error: No PDF conversion tool found"
    echo "Please install one of:"
    echo "  - Google Chrome"
    echo "  - brew install wkhtmltopdf"
    echo "  - pip3 install weasyprint"
    return 1
}

# Usage
convert_html_to_pdf "$@"
```

## Installation

### Option 1: Install wkhtmltopdf (Recommended)
```bash
brew install wkhtmltopdf
```

### Option 2: Install Python WeasyPrint
```bash
pip3 install weasyprint
```

### Option 3: Use Chrome (No installation needed)
Chrome is usually already installed on most systems.

## Quick Conversion Commands

### Single File Conversion
```bash
# Using Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu \
  --print-to-pdf=output.pdf \
  input.html

# Using wkhtmltopdf
wkhtmltopdf input.html output.pdf

# Using Python
python3 -c "from weasyprint import HTML; HTML('input.html').write_pdf('output.pdf')"
```

### Batch Conversion
```bash
# Convert all HTML files in current directory
for file in *.html; do
    [ -f "$file" ] || continue
    output="${file%.html}.pdf"
    echo "Converting $file -> $output"
    convert_html_to_pdf "$file" "$output"
done
```

## Troubleshooting

### Chrome Headless Issues
- Ensure Chrome is fully closed before running headless mode
- Add `--no-sandbox` if running as root
- Use `--virtual-time-budget=5000` for slow-loading pages

### wkhtmltopdf Issues
- Install XQuartz if on macOS: `brew install xquartz`
- Use `--enable-local-file-access` for local images
- Check version: `wkhtmltopdf --version`

### WeasyPrint Issues
- Install dependencies: `brew install python3 cairo pango gdk-pixbuf libffi`
- Reinstall: `pip3 install --upgrade weasyprint`

## Best Practices

1. **For toddler weekly newsletters:**
   - Use Chrome headless for best color accuracy
   - Ensure HTML width is 1080px or less
   - Test print preview first

2. **For large files:**
   - Use wkhtmltopdf for better memory management
   - Consider splitting into smaller sections

3. **For automated workflows:**
   - Use WeasyPrint for Python integration
   - Add error handling and retry logic

## Example Usage in Context

```bash
# Convert the toddler newsletter
HTML_FILE="/Users/qianyan/托班第3-4周周报_Infant D_色彩与形状探究_奶油色柔和.html"
PDF_FILE="/Users/qianyan/托班第3-4周周报_Infant D_色彩与形状探究_奶油色柔和.pdf"

convert_html_to_pdf "$HTML_FILE" "$PDF_FILE"

echo "PDF created successfully at: $PDF_FILE"
```
