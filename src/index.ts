#!/usr/bin/env node

/**
 * DZINE AI MCP Server (Browser Automation)
 *
 * A Model Context Protocol server that uses Playwright to automate
 * the DZINE AI website with your Google login.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DzineBrowser } from './dzine-browser.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Initialize the browser automation client
const dzineBrowser = new DzineBrowser({
  headless: process.env.DZINE_HEADLESS !== 'false',
  userDataDir: process.env.DZINE_USER_DATA_DIR,
});

// Output directory for downloaded images
const OUTPUT_DIR = process.env.DZINE_OUTPUT_DIR || path.join(os.homedir(), 'dzine-output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Define available tools
const tools: Tool[] = [
  {
    name: 'dzine_login',
    description: 'Check login status or get instructions for logging in to DZINE AI with your Google account. Run this first if you haven\'t logged in yet.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'dzine_text_to_image',
    description: 'Generate images from text descriptions using DZINE AI. Creates high-quality images based on your prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description of the image you want to generate',
        },
        negative_prompt: {
          type: 'string',
          description: 'Things to avoid in the generated image',
        },
        style: {
          type: 'string',
          description: 'Style preset to apply (e.g., "anime", "realistic", "artistic", "3d")',
        },
        width: {
          type: 'number',
          description: 'Image width in pixels (default: 1024)',
          default: 1024,
        },
        height: {
          type: 'number',
          description: 'Image height in pixels (default: 1024)',
          default: 1024,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'dzine_image_to_image',
    description: 'Transform an existing image based on a text prompt. Upload an image and describe how to change it.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description of how to transform the image',
        },
        image_path: {
          type: 'string',
          description: 'Local file path to the source image',
        },
        style: {
          type: 'string',
          description: 'Style preset to apply',
        },
        strength: {
          type: 'number',
          description: 'How much to transform the image (0-1, higher = more change)',
          default: 0.75,
        },
      },
      required: ['prompt', 'image_path'],
    },
  },
  {
    name: 'dzine_style_transfer',
    description: 'Apply the visual style of one image to another. Transfer artistic styles, color palettes, or textures.',
    inputSchema: {
      type: 'object',
      properties: {
        content_image_path: {
          type: 'string',
          description: 'Path to the content image (the image to be styled)',
        },
        style_image_path: {
          type: 'string',
          description: 'Path to the style reference image',
        },
        style_intensity: {
          type: 'number',
          description: 'How strongly to apply the style (0-1, default: 0.8)',
          default: 0.8,
        },
      },
      required: ['content_image_path', 'style_image_path'],
    },
  },
  {
    name: 'dzine_remove_background',
    description: 'Remove the background from an image, leaving only the main subject.',
    inputSchema: {
      type: 'object',
      properties: {
        image_path: {
          type: 'string',
          description: 'Path to the image file',
        },
      },
      required: ['image_path'],
    },
  },
  {
    name: 'dzine_get_styles',
    description: 'Get a list of available style presets for image generation.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'dzine_screenshot',
    description: 'Take a screenshot of the current DZINE browser state for debugging.',
    inputSchema: {
      type: 'object',
      properties: {
        output_name: {
          type: 'string',
          description: 'Name for the screenshot file (without extension)',
          default: 'dzine-screenshot',
        },
      },
      required: [],
    },
  },
];

// Create the MCP server
const server = new Server(
  {
    name: 'dzine-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'dzine_login': {
        const isLoggedIn = await dzineBrowser.isLoggedIn();

        if (isLoggedIn) {
          return {
            content: [
              {
                type: 'text',
                text: '✅ You are logged in to DZINE AI and ready to generate images!',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `⚠️ Not logged in to DZINE AI.

To log in with your Google account, run this command in your terminal:

  cd ${process.cwd()} && npm run login

This will open a browser window where you can log in with Google.
Your session will be saved for future use.

After logging in, try this tool again to confirm.`,
            },
          ],
        };
      }

      case 'dzine_text_to_image': {
        const isLoggedIn = await dzineBrowser.isLoggedIn();
        if (!isLoggedIn) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ Please log in first. Run: npm run login',
              },
            ],
            isError: true,
          };
        }

        const result = await dzineBrowser.textToImage({
          prompt: args?.prompt as string,
          negativePrompt: args?.negative_prompt as string | undefined,
          style: args?.style as string | undefined,
          width: args?.width as number | undefined,
          height: args?.height as number | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error generating image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        // Download images to output directory
        const savedPaths: string[] = [];
        if (result.imageUrls) {
          for (let i = 0; i < result.imageUrls.length; i++) {
            const url = result.imageUrls[i];
            const filename = `generated-${Date.now()}-${i}.png`;
            const outputPath = path.join(OUTPUT_DIR, filename);

            const downloaded = await dzineBrowser.downloadImage(url, outputPath);
            if (downloaded) {
              savedPaths.push(outputPath);
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '✅ Image generated successfully!',
                  imageUrls: result.imageUrls,
                  savedTo: savedPaths,
                  outputDirectory: OUTPUT_DIR,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_image_to_image': {
        const isLoggedIn = await dzineBrowser.isLoggedIn();
        if (!isLoggedIn) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ Please log in first. Run: npm run login',
              },
            ],
            isError: true,
          };
        }

        const imagePath = args?.image_path as string;
        if (!fs.existsSync(imagePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Image file not found: ${imagePath}`,
              },
            ],
            isError: true,
          };
        }

        const result = await dzineBrowser.imageToImage({
          prompt: args?.prompt as string,
          imagePath,
          style: args?.style as string | undefined,
          strength: args?.strength as number | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error transforming image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        // Download images
        const savedPaths: string[] = [];
        if (result.imageUrls) {
          for (let i = 0; i < result.imageUrls.length; i++) {
            const url = result.imageUrls[i];
            const filename = `transformed-${Date.now()}-${i}.png`;
            const outputPath = path.join(OUTPUT_DIR, filename);

            const downloaded = await dzineBrowser.downloadImage(url, outputPath);
            if (downloaded) {
              savedPaths.push(outputPath);
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '✅ Image transformed successfully!',
                  imageUrls: result.imageUrls,
                  savedTo: savedPaths,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_style_transfer': {
        const isLoggedIn = await dzineBrowser.isLoggedIn();
        if (!isLoggedIn) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ Please log in first. Run: npm run login',
              },
            ],
            isError: true,
          };
        }

        const contentPath = args?.content_image_path as string;
        const stylePath = args?.style_image_path as string;

        if (!fs.existsSync(contentPath)) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Content image not found: ${contentPath}`,
              },
            ],
            isError: true,
          };
        }

        if (!fs.existsSync(stylePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Style image not found: ${stylePath}`,
              },
            ],
            isError: true,
          };
        }

        const result = await dzineBrowser.styleTransfer({
          contentImagePath: contentPath,
          styleImagePath: stylePath,
          styleIntensity: args?.style_intensity as number | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error applying style transfer: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        // Download images
        const savedPaths: string[] = [];
        if (result.imageUrls) {
          for (let i = 0; i < result.imageUrls.length; i++) {
            const url = result.imageUrls[i];
            const filename = `style-transfer-${Date.now()}-${i}.png`;
            const outputPath = path.join(OUTPUT_DIR, filename);

            const downloaded = await dzineBrowser.downloadImage(url, outputPath);
            if (downloaded) {
              savedPaths.push(outputPath);
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '✅ Style transfer applied successfully!',
                  imageUrls: result.imageUrls,
                  savedTo: savedPaths,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_remove_background': {
        const isLoggedIn = await dzineBrowser.isLoggedIn();
        if (!isLoggedIn) {
          return {
            content: [
              {
                type: 'text',
                text: '⚠️ Please log in first. Run: npm run login',
              },
            ],
            isError: true,
          };
        }

        const imagePath = args?.image_path as string;
        if (!fs.existsSync(imagePath)) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Image file not found: ${imagePath}`,
              },
            ],
            isError: true,
          };
        }

        const result = await dzineBrowser.removeBackground({
          imagePath,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Error removing background: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        // Download images
        const savedPaths: string[] = [];
        if (result.imageUrls) {
          for (let i = 0; i < result.imageUrls.length; i++) {
            const url = result.imageUrls[i];
            const filename = `no-background-${Date.now()}-${i}.png`;
            const outputPath = path.join(OUTPUT_DIR, filename);

            const downloaded = await dzineBrowser.downloadImage(url, outputPath);
            if (downloaded) {
              savedPaths.push(outputPath);
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '✅ Background removed successfully!',
                  imageUrls: result.imageUrls,
                  savedTo: savedPaths,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_get_styles': {
        const styles = await dzineBrowser.getStyles();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Available styles',
                  styles: styles.length > 0 ? styles : 'Could not retrieve styles. Please ensure you are logged in.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_screenshot': {
        const outputName = (args?.output_name as string) || 'dzine-screenshot';
        const screenshotPath = path.join(OUTPUT_DIR, `${outputName}.png`);

        const success = await dzineBrowser.screenshot(screenshotPath);

        if (!success) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Failed to take screenshot',
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Screenshot saved to: ${screenshotPath}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on('SIGINT', async () => {
  await dzineBrowser.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await dzineBrowser.close();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DZINE MCP Server (Playwright) running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
