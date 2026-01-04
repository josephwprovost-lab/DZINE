# DZINE AI MCP Server (Browser Automation)

A Model Context Protocol (MCP) server that uses Playwright to automate [DZINE AI](https://www.dzine.ai/) with your existing Google login. No API key required!

## Features

This MCP server provides the following tools:

| Tool | Description |
|------|-------------|
| `dzine_login` | Check login status or get login instructions |
| `dzine_text_to_image` | Generate images from text descriptions |
| `dzine_image_to_image` | Transform existing images based on prompts |
| `dzine_style_transfer` | Apply visual styles from one image to another |
| `dzine_remove_background` | Remove backgrounds from images |
| `dzine_get_styles` | List available style presets |
| `dzine_screenshot` | Take a screenshot for debugging |

## How It Works

Instead of using an API key, this MCP uses Playwright to automate the DZINE AI website in a browser. Your Google login session is saved locally, so you only need to log in once.

## Installation

### Prerequisites

- Node.js 18 or higher
- A Google account with access to DZINE AI

### Install from source

```bash
git clone https://github.com/your-repo/dzine-mcp.git
cd dzine-mcp
npm install
npm run build
```

This will automatically install Playwright and the Chromium browser.

## Setup

### Step 1: Log in to DZINE AI

Before using the MCP server, you need to log in once:

```bash
npm run login
```

This opens a browser window where you can:
1. Go to dzine.ai
2. Click "Sign In"
3. Log in with your Google account
4. Close the browser when done

Your login session is saved in `~/.dzine-mcp/browser-data/` and will be reused automatically.

### Step 2: Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "dzine": {
      "command": "node",
      "args": ["/path/to/dzine-mcp/dist/index.js"]
    }
  }
}
```

### Step 3: Verify Login

In Claude, ask it to check your DZINE login status:

```
Check if I'm logged into DZINE
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DZINE_HEADLESS` | `true` | Set to `false` to see the browser |
| `DZINE_USER_DATA_DIR` | `~/.dzine-mcp/browser-data` | Browser profile directory |
| `DZINE_OUTPUT_DIR` | `~/dzine-output` | Where generated images are saved |

### Running with visible browser (for debugging)

```json
{
  "mcpServers": {
    "dzine": {
      "command": "node",
      "args": ["/path/to/dzine-mcp/dist/index.js"],
      "env": {
        "DZINE_HEADLESS": "false"
      }
    }
  }
}
```

## Usage Examples

### Generate an image from text

```
Use DZINE to generate a beautiful sunset over mountains with a lake in the foreground
```

### Transform an existing image

```
Use DZINE to transform /path/to/my/photo.jpg to look like a watercolor painting
```

### Apply style transfer

```
Use DZINE style transfer to apply the style from /path/to/starry-night.jpg to /path/to/my-photo.jpg
```

### Remove background

```
Use DZINE to remove the background from /path/to/product-photo.jpg
```

## Tool Details

### dzine_login

Check login status or get instructions for logging in.

**Parameters:** None

### dzine_text_to_image

Generate images from text descriptions.

**Parameters:**
- `prompt` (required): Text description of the image
- `negative_prompt`: Things to avoid in the image
- `style`: Style preset (e.g., "anime", "realistic", "artistic")
- `width`: Image width in pixels (default: 1024)
- `height`: Image height in pixels (default: 1024)

### dzine_image_to_image

Transform an existing image based on a prompt.

**Parameters:**
- `prompt` (required): How to transform the image
- `image_path` (required): Local path to the source image
- `style`: Style preset to apply
- `strength`: Transformation intensity (0-1, default: 0.75)

### dzine_style_transfer

Apply the visual style of one image to another.

**Parameters:**
- `content_image_path` (required): Path to the content image
- `style_image_path` (required): Path to the style reference image
- `style_intensity`: Style strength (0-1, default: 0.8)

### dzine_remove_background

Remove the background from an image.

**Parameters:**
- `image_path` (required): Path to the image file

### dzine_get_styles

Get available style presets. No parameters required.

### dzine_screenshot

Take a screenshot of the current browser state.

**Parameters:**
- `output_name`: Name for the screenshot file (default: "dzine-screenshot")

## Output

Generated images are saved to `~/dzine-output/` by default. You can change this with the `DZINE_OUTPUT_DIR` environment variable.

## Troubleshooting

### "Not logged in" error

Run `npm run login` to open a browser and log in with your Google account.

### Browser automation not working

The DZINE website may have changed. Try:
1. Run with `DZINE_HEADLESS=false` to see what's happening
2. Use `dzine_screenshot` to capture the current state
3. Report issues at the repository

### Images not generating

DZINE uses a credit system. Make sure your account has available credits.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run login helper
npm run login
```

## Notes

- This MCP uses browser automation, which may be slower than a direct API
- The DZINE website UI may change, requiring updates to the automation code
- Your login session is stored locally and not shared
- Generated images are downloaded and saved locally

## License

MIT
