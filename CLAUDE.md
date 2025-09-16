# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Visual Subnet Calculator is a web-based tool for designing network layouts with visual subnet splitting/joining capabilities. The application is built with vanilla JavaScript, Bootstrap 5, and runs as a static site.

## Architecture

### Core Structure

- **Static Site**: The application is entirely client-side (no backend server)
- **Main Application**: `dist/js/main.js` - Contains all subnet calculation logic and UI interaction
- **Styling**: Bootstrap 5 with custom SCSS (`src/scss/custom.scss` compiled to `dist/css/bootstrap.min.css`)
- **HTML Entry**: `dist/index.html` - Single page application
- **State Management**: Uses URL parameters for sharing designs (compressed with lz-string)

### Operating Modes

The calculator supports multiple cloud provider modes with different subnet restrictions:

- **Standard**: /32 minimum, 2 reserved addresses
- **AWS**: /28 minimum, 5 reserved addresses
- **Azure**: /29 minimum, 5 reserved addresses
- **OCI**: /30 minimum, 3 reserved addresses

## Development Commands

### Setup and Build

```bash
cd src
nvm use                    # Use Node.js version 20 (if using nvm)
npm install               # Install dependencies (includes global sass installation)
npm run build             # Compile SCSS to CSS and copy dependencies to dist/
```

### Development Server

```bash
# Basic HTTP server
npm start                 # Serves from ../dist on http://localhost:8080

# HTTPS server (required for clipboard features)
npm run setup:certs       # One-time: Generate local certificates (requires mkcert)
npm run local-secure-start # Serves on https://localhost:8443
```

### Testing

```bash
npm test                  # Run all Playwright tests
npx playwright test [file] # Run specific test file
npx playwright test --headed # Run tests with browser UI
npx playwright test --debug # Debug tests interactively
NO_SERVER=1 npx playwright test # Skip server startup (run tests in parallel)
```

## Project Structure

```
/
├── src/
│   ├── package.json          # Dependencies and scripts
│   ├── playwright.config.ts  # Test configuration
│   ├── scss/
│   │   └── custom.scss      # Custom Bootstrap styling
│   └── tests/               # Playwright test specs
└── dist/                    # Production build output
    ├── index.html          # Main application
    ├── js/
    │   ├── main.js        # Core application logic
    │   └── lz-string.min.js # URL compression library
    └── css/
        └── bootstrap.min.css # Compiled styles
```

## Key Implementation Details

### Subnet Calculation (`dist/js/main.js`)

- Uses `subnetMap` object to track subnet hierarchy
- Implements split/join operations with visual feedback
- Handles subnet notes and color coding
- URL sharing via compressed query parameters (v1 format)

### Testing Setup

- Playwright configured for Chromium and Firefox
- Tests run against local HTTPS server (port 8443)
- Clipboard permissions enabled for testing copy functionality
- Viewport set to 1920x1080 for consistent testing

### Build Process

1. SCSS compilation: `scss/custom.scss` → `dist/css/bootstrap.min.css`
2. Dependency copying: `lz-string.min.js` → `dist/js/`
3. All static assets served from `dist/` directory

## Important Notes

- The application runs entirely client-side with no server persistence
- All state is managed through URL parameters for sharing
- Clipboard features require HTTPS in development
- Tests require the local secure server to be running

## Key Features and Implementation Patterns

### Auto-Allocation Feature

Located in `dist/js/main.js`, the auto-allocation feature:

- **Always starts fresh**: Clears `subnetMap = {}` before allocating to prevent duplicates
- **Preserves input order**: Does NOT sort subnets by size - allocates in the order specified
- **Handles padding**: "Pad after each subnet" adds spacing between allocations (not at the end)
- **Ensures proper alignment**: All subnets are aligned to their natural boundaries (e.g., /24 on /24 boundary)
- **Visual splitting**: Uses recursive splitting to create the proper subnet hierarchy in the visual table

Key functions:

- `parseSubnetRequests()` - Parses user input, returns in original order (no sorting!)
- `isValidSubnetAlignment()` - Checks if an IP is properly aligned for its subnet size
- `performAllocationSplits()` - Recursively splits the network to create required subnets

### Network Analysis (formerly Validate Alignment)

The "Analyze Network" button provides actionable insights:

- Network utilization percentage
- Gap detection between subnets
- Proper alignment validation for each subnet
- Overlap detection (shouldn't happen but good safety check)

### Testing Patterns

- **Test organization**: Tests grouped by feature area (auto-allocation, browser-history, print-styles, etc.)
- **Common test pattern**: Always wait after clicks (`waitForTimeout(500)`) for UI updates
- **Server requirement**: Tests need HTTPS server running on port 8443 unless using `NO_SERVER=1`

### Common Pitfalls to Avoid

1. **Don't edit compiled files**: The project structure is unusual - `dist/js/main.js` IS the source file, not compiled output
2. **Subnet alignment**: A subnet must start on its size boundary (e.g., /25 must start on a /25 boundary like .0, .128)
3. **Reset behavior**: The `reset()` function tries to preserve data - for clean slate, clear `subnetMap` first
4. **Sorting subnets**: User input order matters - don't sort by size as it changes the allocation layout
5. **Padding vs Reserve**: Padding is between each subnet, not just at the end of the network

### Debugging Tips

- Use browser console to inspect `subnetMap` object structure
- The subnet hierarchy is recursive - leaf nodes have no sub-keys
- Notes and colors are stored with `_note` and `_color` keys
- Use "Analyze Network" to quickly identify gaps and alignment issues
