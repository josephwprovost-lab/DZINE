/**
 * DZINE AI API Client
 *
 * This client provides methods to interact with the DZINE AI API
 * for image generation, transformation, and editing.
 */

export interface DzineConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface TextToImageRequest {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  width?: number;
  height?: number;
  numImages?: number;
  seed?: number;
  guidanceScale?: number;
  steps?: number;
}

export interface ImageToImageRequest {
  prompt: string;
  imageUrl?: string;
  imageBase64?: string;
  negativePrompt?: string;
  style?: string;
  strength?: number;
  width?: number;
  height?: number;
  seed?: number;
  guidanceScale?: number;
}

export interface StyleTransferRequest {
  contentImageUrl?: string;
  contentImageBase64?: string;
  styleImageUrl?: string;
  styleImageBase64?: string;
  styleIntensity?: number;
  preserveColor?: boolean;
}

export interface BackgroundRemovalRequest {
  imageUrl?: string;
  imageBase64?: string;
  outputFormat?: 'png' | 'webp';
}

export interface ImageEditRequest {
  imageUrl?: string;
  imageBase64?: string;
  prompt: string;
  maskUrl?: string;
  maskBase64?: string;
  editType?: 'inpaint' | 'outpaint' | 'remove' | 'replace';
}

export interface UpscaleRequest {
  imageUrl?: string;
  imageBase64?: string;
  scale?: 2 | 4;
}

export interface GeneratedImage {
  url: string;
  base64?: string;
  width: number;
  height: number;
  seed?: number;
}

export interface DzineResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  taskId?: string;
}

export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: GeneratedImage[];
  error?: string;
}

export interface StyleInfo {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  category?: string;
}

export class DzineClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: DzineConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.dzine.ai/v1';
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    body?: Record<string, unknown>
  ): Promise<DzineResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as T,
        taskId: data.taskId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate images from text descriptions
   */
  async textToImage(request: TextToImageRequest): Promise<DzineResponse<GeneratedImage[]>> {
    return this.request<GeneratedImage[]>('/generate/text-to-image', 'POST', {
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      style: request.style,
      width: request.width || 1024,
      height: request.height || 1024,
      num_images: request.numImages || 1,
      seed: request.seed,
      guidance_scale: request.guidanceScale || 7.5,
      steps: request.steps || 30,
    });
  }

  /**
   * Transform an existing image based on a prompt
   */
  async imageToImage(request: ImageToImageRequest): Promise<DzineResponse<GeneratedImage[]>> {
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      negative_prompt: request.negativePrompt,
      style: request.style,
      strength: request.strength || 0.75,
      width: request.width,
      height: request.height,
      seed: request.seed,
      guidance_scale: request.guidanceScale || 7.5,
    };

    if (request.imageUrl) {
      body.image_url = request.imageUrl;
    } else if (request.imageBase64) {
      body.image_base64 = request.imageBase64;
    }

    return this.request<GeneratedImage[]>('/generate/image-to-image', 'POST', body);
  }

  /**
   * Apply style from one image to another
   */
  async styleTransfer(request: StyleTransferRequest): Promise<DzineResponse<GeneratedImage[]>> {
    const body: Record<string, unknown> = {
      style_intensity: request.styleIntensity || 0.8,
      preserve_color: request.preserveColor || false,
    };

    if (request.contentImageUrl) {
      body.content_image_url = request.contentImageUrl;
    } else if (request.contentImageBase64) {
      body.content_image_base64 = request.contentImageBase64;
    }

    if (request.styleImageUrl) {
      body.style_image_url = request.styleImageUrl;
    } else if (request.styleImageBase64) {
      body.style_image_base64 = request.styleImageBase64;
    }

    return this.request<GeneratedImage[]>('/generate/style-transfer', 'POST', body);
  }

  /**
   * Remove background from an image
   */
  async removeBackground(request: BackgroundRemovalRequest): Promise<DzineResponse<GeneratedImage[]>> {
    const body: Record<string, unknown> = {
      output_format: request.outputFormat || 'png',
    };

    if (request.imageUrl) {
      body.image_url = request.imageUrl;
    } else if (request.imageBase64) {
      body.image_base64 = request.imageBase64;
    }

    return this.request<GeneratedImage[]>('/edit/remove-background', 'POST', body);
  }

  /**
   * Edit an image with AI (inpainting, outpainting, object removal/replacement)
   */
  async editImage(request: ImageEditRequest): Promise<DzineResponse<GeneratedImage[]>> {
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      edit_type: request.editType || 'inpaint',
    };

    if (request.imageUrl) {
      body.image_url = request.imageUrl;
    } else if (request.imageBase64) {
      body.image_base64 = request.imageBase64;
    }

    if (request.maskUrl) {
      body.mask_url = request.maskUrl;
    } else if (request.maskBase64) {
      body.mask_base64 = request.maskBase64;
    }

    return this.request<GeneratedImage[]>('/edit/image', 'POST', body);
  }

  /**
   * Upscale an image to higher resolution
   */
  async upscaleImage(request: UpscaleRequest): Promise<DzineResponse<GeneratedImage[]>> {
    const body: Record<string, unknown> = {
      scale: request.scale || 2,
    };

    if (request.imageUrl) {
      body.image_url = request.imageUrl;
    } else if (request.imageBase64) {
      body.image_base64 = request.imageBase64;
    }

    return this.request<GeneratedImage[]>('/edit/upscale', 'POST', body);
  }

  /**
   * Get the status of an async task
   */
  async getTaskStatus(taskId: string): Promise<DzineResponse<TaskStatus>> {
    return this.request<TaskStatus>(`/tasks/${taskId}`, 'GET');
  }

  /**
   * Get available styles for image generation
   */
  async getStyles(): Promise<DzineResponse<StyleInfo[]>> {
    return this.request<StyleInfo[]>('/styles', 'GET');
  }

  /**
   * Get account information and credits
   */
  async getAccountInfo(): Promise<DzineResponse<{ credits: number; plan: string }>> {
    return this.request<{ credits: number; plan: string }>('/account', 'GET');
  }
}
