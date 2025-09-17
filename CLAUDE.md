# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Visual Subnet Calculator is a web-based tool for designing network layouts with visual subnet splitting/joining capabilities. The application is built with vanilla JavaScript, Bootstrap 5, and runs as a static site. Available at [visualsubnetcalc.com](https://visualsubnetcalc.com).

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
npx playwright test [file]:[line] --reporter=list --project=chromium # Run specific test at line number
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
- **Multiple sort options**: Preserve input order (default), alphabetical by name, or optimize space usage
- **Smart padding**: Adds spacing between allocations with intelligent look-ahead for alignment
- **Flexible alignment**: Supports custom alignment boundaries (e.g., align all to /24)
- **Selective alignment**: Option to align only large subnets while keeping small ones naturally aligned
- **Visual splitting**: Uses recursive splitting to create the proper subnet hierarchy in the visual table
- **Spare consolidation**: Creates properly-sized spare blocks instead of fragmented pieces

Key functions:

- `parseSubnetRequests()` - Parses user input with optional sorting
- `isValidSubnetAlignment()` - Checks if an IP is properly aligned for its subnet size
- `getNextAlignedSubnet()` - Finds next properly aligned address for a subnet
- `performAllocationSplits()` - Recursively splits the network to create required subnets
- `parseSubnetSize()` - Validates and parses subnet size inputs (empty, 0, /0, or /9-/32)

### Network Analysis (formerly Validate Alignment)

The "Analyze Network" button provides actionable insights:

- Network utilization percentage
- Gap detection between subnets
- Proper alignment validation for each subnet
- Overlap detection (shouldn't happen but good safety check)

### Mirror Network Feature

The "Mirror" button enables creation of duplicate network layouts for blue-green deployments or DR sites:

- **Label System**: Uses customizable labels (default: Blue/Green) instead of generic Source/Mirror
- **Two Actions in Modal**:
  - "Copy Source and Mirror" - Exports both networks to clipboard for Excel/Confluence
  - "Replace Source with Mirror" - Replaces current view with mirror network
- **Validation**:
  - IPv4 format validation using regex pattern
  - Network alignment validation (must align to same CIDR boundary as source)
  - Real-time visual feedback with Bootstrap `is-valid`/`is-invalid` classes
  - Buttons disabled when input is invalid
- **Smart Suggestions**: Pre-fills mirror network suggestion (e.g., 10.100.0.0 for 10.0.0.0)
- **Excel-friendly Output**: Source/Mirror in first column for easy filtering

Key functions:

- `generateMirrorData()` - Creates mirror data without modifying current view
- `generateMirrorAllocation()` - Replaces current network with mirror
- `captureTableData()` - Captures complete table state for source preservation
- Validation regex: `/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/`

### Additional Columns

The table supports toggling additional columns for detailed information:

- **IP** - First IP address of the subnet
- **CIDR** - CIDR notation (e.g., /24)
- **Mask** - Subnet mask in dotted decimal (e.g., 255.255.255.0)
- **Type** - Address type (RFC1918, RFC6598, Public)

Column visibility is toggled via "Show/Hide Additional Columns" button.

### Testing Patterns

- **Test organization**: Tests grouped by feature area (auto-allocation, browser-history, print-styles, etc.)
- **Common test pattern**: Always wait after clicks (`waitForTimeout(500)`) for UI updates
- **Server requirement**: Tests need HTTPS server running on port 8443 unless using `NO_SERVER=1`
- **Available test files**: auto-allocation, browser-history, print-styles, import-export, deep-functional, bug-fixes

### Recent Features (2024)

#### Keyboard Navigation
- Arrow keys navigate between subnet note fields (up/down for rows)
- Tab key moves to next row's note field
- Implemented in note field keydown handlers

#### RFC Address Detection
- Detects RFC1918 private addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Detects RFC6598 shared address space (100.64.0.0/10)
- Shows Type column with values: RFC1918, RFC6598, or Public

#### Copy Table Enhancement
- Copies ALL columns including additional columns
- Includes parent network information at top
- Excel/Confluence-friendly formatting
- Shows both visible and hidden columns in export

#### Auto-Allocation Improvements
- **Sort options**: Preserve order, alphabetical, or optimize space
- **Alignment options**: Custom boundaries with selective application
- **Smart padding**: Look-ahead logic considers next subnet's alignment
- **Spare blocks**: Creates properly-sized blocks instead of fragments

### Common Pitfalls to Avoid

1. **Don't edit compiled files**: The project structure is unusual - `dist/js/main.js` IS the source file, not compiled output
2. **Subnet alignment**: A subnet must start on its size boundary (e.g., /25 must start on a /25 boundary like .0, .128)
3. **Reset behavior**: The `reset()` function tries to preserve data - for clean slate, clear `subnetMap` first
4. **Sorting subnets**: User input order matters unless explicitly sorted via dropdown
5. **Padding vs alignment**: Padding adds space, alignment ensures boundary compliance
6. **Working directory**: Always run commands from the `src/` directory (npm, tests, builds)
7. **Test server conflicts**: Kill any running servers before starting tests to avoid port conflicts
8. **Auto-allocation state**: Don't update textarea with spare subnets - keep original requests only

### Debugging Tips

- Use browser console to inspect `subnetMap` object structure
- The subnet hierarchy is recursive - leaf nodes have no sub-keys
- Notes and colors are stored with `_note` and `_color` keys
- Use "Analyze Network" to quickly identify gaps and alignment issues
