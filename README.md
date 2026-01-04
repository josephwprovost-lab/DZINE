# DZINE AI MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with [DZINE AI](https://www.dzine.ai/) - an AI-powered image generation and design platform.

## Features

This MCP server provides the following tools:

| Tool | Description |
|------|-------------|
| `dzine_text_to_image` | Generate images from text descriptions |
| `dzine_image_to_image` | Transform existing images based on prompts |
| `dzine_style_transfer` | Apply visual styles from one image to another |
| `dzine_remove_background` | Remove backgrounds from images |
| `dzine_edit_image` | Edit images with AI (inpaint, outpaint, remove, replace) |
| `dzine_upscale` | Upscale images to higher resolution |
| `dzine_get_styles` | List available style presets |
| `dzine_get_task_status` | Check async task status |
| `dzine_get_account` | Get account info and credits |

## Installation

### Prerequisites

- Node.js 18 or higher
- A DZINE AI API key (get one at [dzine.ai/api](https://www.dzine.ai/api/))

### Install from source

```bash
git clone https://github.com/your-repo/dzine-mcp.git
cd dzine-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DZINE_API_KEY` | Yes | Your DZINE AI API key |
| `DZINE_BASE_URL` | No | Custom API base URL (default: `https://api.dzine.ai/v1`) |

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "dzine": {
      "command": "node",
      "args": ["/path/to/dzine-mcp/dist/index.js"],
      "env": {
        "DZINE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code Configuration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "dzine": {
      "command": "node",
      "args": ["/path/to/dzine-mcp/dist/index.js"],
      "env": {
        "DZINE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage Examples

### Generate an image from text

```
Use dzine_text_to_image to create a beautiful sunset over mountains with a lake in the foreground, in a realistic style
```

### Transform an existing image

```
Use dzine_image_to_image with this image URL and transform it to look like a watercolor painting
```

### Apply style transfer

```
Use dzine_style_transfer to apply the style from Van Gogh's Starry Night to my photo
```

### Remove background

```
Use dzine_remove_background on this product photo to get a transparent PNG
```

### Edit an image

```
Use dzine_edit_image to remove the person from the background of this photo
```

### Upscale an image

```
Use dzine_upscale to increase this image resolution by 4x
```

## Tool Details

### dzine_text_to_image

Generate images from text descriptions.

**Parameters:**
- `prompt` (required): Text description of the image
- `negative_prompt`: Things to avoid in the image
- `style`: Style preset (e.g., "anime", "realistic", "artistic")
- `width`: Image width in pixels (default: 1024)
- `height`: Image height in pixels (default: 1024)
- `num_images`: Number of images to generate (1-4)
- `seed`: Random seed for reproducibility
- `guidance_scale`: Prompt adherence (1-20, default: 7.5)

### dzine_image_to_image

Transform an existing image based on a prompt.

**Parameters:**
- `prompt` (required): How to transform the image
- `image_url`: URL of the source image
- `image_base64`: Base64-encoded source image
- `negative_prompt`: Things to avoid
- `style`: Style preset to apply
- `strength`: Transformation intensity (0-1, default: 0.75)
- `seed`: Random seed

### dzine_style_transfer

Apply the visual style of one image to another.

**Parameters:**
- `content_image_url`: URL of the content image
- `content_image_base64`: Base64-encoded content image
- `style_image_url`: URL of the style reference
- `style_image_base64`: Base64-encoded style reference
- `style_intensity`: Style strength (0-1, default: 0.8)
- `preserve_color`: Keep original colors (default: false)

### dzine_remove_background

Remove the background from an image.

**Parameters:**
- `image_url`: URL of the image
- `image_base64`: Base64-encoded image
- `output_format`: Output format - "png" or "webp" (default: png)

### dzine_edit_image

Edit an image with AI assistance.

**Parameters:**
- `prompt` (required): Description of the edit
- `image_url`: URL of the image
- `image_base64`: Base64-encoded image
- `mask_url`: URL of the mask (white = edit area)
- `mask_base64`: Base64-encoded mask
- `edit_type`: Type of edit - "inpaint", "outpaint", "remove", "replace"

### dzine_upscale

Upscale an image to higher resolution.

**Parameters:**
- `image_url`: URL of the image
- `image_base64`: Base64-encoded image
- `scale`: Upscale factor - 2 or 4 (default: 2)

### dzine_get_styles

Get available style presets. No parameters required.

### dzine_get_task_status

Check the status of an async generation task.

**Parameters:**
- `task_id` (required): The task ID from a generation request

### dzine_get_account

Get account information and remaining credits. No parameters required.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Run directly with ts-node
npm run dev
```

## API Notes

This MCP server is designed to work with DZINE AI's API. The actual API endpoints and parameters may need adjustment based on DZINE's official API documentation. Please refer to [dzine.ai/api](https://www.dzine.ai/api/) for the most up-to-date API specifications.

## License

MIT
