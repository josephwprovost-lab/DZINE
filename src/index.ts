#!/usr/bin/env node

/**
 * DZINE AI MCP Server
 *
 * A Model Context Protocol server that provides tools for interacting with
 * DZINE AI's image generation and editing capabilities.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DzineClient } from './dzine-client.js';

// Get API key from environment
const DZINE_API_KEY = process.env.DZINE_API_KEY;
const DZINE_BASE_URL = process.env.DZINE_BASE_URL;

if (!DZINE_API_KEY) {
  console.error('Error: DZINE_API_KEY environment variable is required');
  console.error('Please set your DZINE API key: export DZINE_API_KEY=your_api_key');
  process.exit(1);
}

// Initialize the DZINE client
const dzineClient = new DzineClient({
  apiKey: DZINE_API_KEY,
  baseUrl: DZINE_BASE_URL,
});

// Define available tools
const tools: Tool[] = [
  {
    name: 'dzine_text_to_image',
    description: 'Generate images from text descriptions using DZINE AI. Creates high-quality images based on your prompt with optional style selection.',
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
        num_images: {
          type: 'number',
          description: 'Number of images to generate (1-4)',
          default: 1,
          minimum: 1,
          maximum: 4,
        },
        seed: {
          type: 'number',
          description: 'Random seed for reproducible results',
        },
        guidance_scale: {
          type: 'number',
          description: 'How closely to follow the prompt (1-20, default: 7.5)',
          default: 7.5,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'dzine_image_to_image',
    description: 'Transform an existing image based on a text prompt. Reimagine or modify images while preserving key elements.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description of how to transform the image',
        },
        image_url: {
          type: 'string',
          description: 'URL of the source image to transform',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded source image (alternative to image_url)',
        },
        negative_prompt: {
          type: 'string',
          description: 'Things to avoid in the transformed image',
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
        seed: {
          type: 'number',
          description: 'Random seed for reproducible results',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'dzine_style_transfer',
    description: 'Apply the visual style of one image to another. Transfer artistic styles, color palettes, or textures between images.',
    inputSchema: {
      type: 'object',
      properties: {
        content_image_url: {
          type: 'string',
          description: 'URL of the content image (the image to be styled)',
        },
        content_image_base64: {
          type: 'string',
          description: 'Base64-encoded content image',
        },
        style_image_url: {
          type: 'string',
          description: 'URL of the style reference image',
        },
        style_image_base64: {
          type: 'string',
          description: 'Base64-encoded style reference image',
        },
        style_intensity: {
          type: 'number',
          description: 'How strongly to apply the style (0-1, default: 0.8)',
          default: 0.8,
        },
        preserve_color: {
          type: 'boolean',
          description: 'Keep original colors while applying style texture',
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: 'dzine_remove_background',
    description: 'Remove the background from an image, leaving only the main subject with transparency.',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL of the image to process',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded image to process',
        },
        output_format: {
          type: 'string',
          enum: ['png', 'webp'],
          description: 'Output image format (default: png)',
          default: 'png',
        },
      },
      required: [],
    },
  },
  {
    name: 'dzine_edit_image',
    description: 'Edit an image using AI. Supports inpainting (fill areas), outpainting (extend image), object removal, and object replacement.',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL of the image to edit',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded image to edit',
        },
        prompt: {
          type: 'string',
          description: 'Description of what to add, change, or how to fill the edited area',
        },
        mask_url: {
          type: 'string',
          description: 'URL of the mask image (white = edit area, black = preserve)',
        },
        mask_base64: {
          type: 'string',
          description: 'Base64-encoded mask image',
        },
        edit_type: {
          type: 'string',
          enum: ['inpaint', 'outpaint', 'remove', 'replace'],
          description: 'Type of edit to perform',
          default: 'inpaint',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'dzine_upscale',
    description: 'Upscale an image to higher resolution using AI enhancement.',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL of the image to upscale',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded image to upscale',
        },
        scale: {
          type: 'number',
          enum: [2, 4],
          description: 'Upscale factor (2x or 4x)',
          default: 2,
        },
      },
      required: [],
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
    name: 'dzine_get_task_status',
    description: 'Check the status of an async image generation task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID returned from a generation request',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'dzine_get_account',
    description: 'Get account information including remaining credits and plan details.',
    inputSchema: {
      type: 'object',
      properties: {},
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
      case 'dzine_text_to_image': {
        const result = await dzineClient.textToImage({
          prompt: args?.prompt as string,
          negativePrompt: args?.negative_prompt as string | undefined,
          style: args?.style as string | undefined,
          width: args?.width as number | undefined,
          height: args?.height as number | undefined,
          numImages: args?.num_images as number | undefined,
          seed: args?.seed as number | undefined,
          guidanceScale: args?.guidance_scale as number | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error generating image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Image generated successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_image_to_image': {
        const result = await dzineClient.imageToImage({
          prompt: args?.prompt as string,
          imageUrl: args?.image_url as string | undefined,
          imageBase64: args?.image_base64 as string | undefined,
          negativePrompt: args?.negative_prompt as string | undefined,
          style: args?.style as string | undefined,
          strength: args?.strength as number | undefined,
          seed: args?.seed as number | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error transforming image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Image transformed successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_style_transfer': {
        const result = await dzineClient.styleTransfer({
          contentImageUrl: args?.content_image_url as string | undefined,
          contentImageBase64: args?.content_image_base64 as string | undefined,
          styleImageUrl: args?.style_image_url as string | undefined,
          styleImageBase64: args?.style_image_base64 as string | undefined,
          styleIntensity: args?.style_intensity as number | undefined,
          preserveColor: args?.preserve_color as boolean | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error applying style transfer: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Style transfer applied successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_remove_background': {
        const result = await dzineClient.removeBackground({
          imageUrl: args?.image_url as string | undefined,
          imageBase64: args?.image_base64 as string | undefined,
          outputFormat: args?.output_format as 'png' | 'webp' | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error removing background: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Background removed successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_edit_image': {
        const result = await dzineClient.editImage({
          imageUrl: args?.image_url as string | undefined,
          imageBase64: args?.image_base64 as string | undefined,
          prompt: args?.prompt as string,
          maskUrl: args?.mask_url as string | undefined,
          maskBase64: args?.mask_base64 as string | undefined,
          editType: args?.edit_type as 'inpaint' | 'outpaint' | 'remove' | 'replace' | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error editing image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Image edited successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_upscale': {
        const result = await dzineClient.upscaleImage({
          imageUrl: args?.image_url as string | undefined,
          imageBase64: args?.image_base64 as string | undefined,
          scale: args?.scale as 2 | 4 | undefined,
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error upscaling image: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Image upscaled successfully',
                  images: result.data,
                  taskId: result.taskId,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_get_styles': {
        const result = await dzineClient.getStyles();

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching styles: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Available styles retrieved',
                  styles: result.data,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'dzine_get_task_status': {
        const result = await dzineClient.getTaskStatus(args?.task_id as string);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching task status: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'dzine_get_account': {
        const result = await dzineClient.getAccountInfo();

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Error fetching account info: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Account information retrieved',
                  account: result.data,
                },
                null,
                2
              ),
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('DZINE MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
