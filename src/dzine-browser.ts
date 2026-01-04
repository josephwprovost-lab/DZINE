/**
 * DZINE AI Browser Automation Client
 *
 * Uses Playwright to automate the DZINE AI website with persistent login.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export interface DzineBrowserConfig {
  userDataDir?: string;
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
}

export interface GenerationResult {
  success: boolean;
  imageUrls?: string[];
  imagePaths?: string[];
  error?: string;
}

export interface StyleOption {
  id: string;
  name: string;
  category?: string;
}

const DEFAULT_USER_DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.dzine-mcp',
  'browser-data'
);

const DZINE_URL = 'https://www.dzine.ai';
const DZINE_APP_URL = 'https://www.dzine.ai/editor';

export class DzineBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: DzineBrowserConfig;
  private isInitialized = false;

  constructor(config: DzineBrowserConfig = {}) {
    this.config = {
      userDataDir: config.userDataDir || DEFAULT_USER_DATA_DIR,
      headless: config.headless ?? true,
      slowMo: config.slowMo || 50,
      timeout: config.timeout || 60000,
    };
  }

  /**
   * Ensure the user data directory exists
   */
  private ensureUserDataDir(): void {
    if (!fs.existsSync(this.config.userDataDir!)) {
      fs.mkdirSync(this.config.userDataDir!, { recursive: true });
    }
  }

  /**
   * Initialize the browser with persistent context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.ensureUserDataDir();

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });

    // Use persistent context to maintain login
    this.context = await chromium.launchPersistentContext(this.config.userDataDir!, {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout!);
    this.isInitialized = true;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
    this.isInitialized = false;
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    await this.initialize();

    try {
      await this.page!.goto(DZINE_URL, { waitUntil: 'networkidle' });

      // Check for login indicators - look for user avatar or account menu
      const loggedInIndicators = [
        '[data-testid="user-avatar"]',
        '.user-avatar',
        '.account-menu',
        '[aria-label="Account"]',
        'button:has-text("My Account")',
        'a:has-text("My Projects")',
      ];

      for (const selector of loggedInIndicators) {
        try {
          const element = await this.page!.$(selector);
          if (element) return true;
        } catch {
          // Continue checking
        }
      }

      // Also check if we can access the editor directly
      await this.page!.goto(DZINE_APP_URL, { waitUntil: 'networkidle' });

      // If redirected to login, we're not logged in
      const currentUrl = this.page!.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Open browser for manual login
   */
  async openForLogin(): Promise<void> {
    // Launch visible browser for login
    const visibleContext = await chromium.launchPersistentContext(this.config.userDataDir!, {
      headless: false,
      slowMo: 50,
      viewport: { width: 1280, height: 800 },
    });

    const page = visibleContext.pages()[0] || await visibleContext.newPage();
    await page.goto(DZINE_URL);

    console.log('\n========================================');
    console.log('DZINE Login');
    console.log('========================================');
    console.log('A browser window has opened.');
    console.log('Please log in with your Google account.');
    console.log('Once logged in, close the browser window.');
    console.log('========================================\n');

    // Wait for the browser to be closed by user
    await new Promise<void>((resolve) => {
      visibleContext.on('close', () => resolve());
    });

    console.log('Login session saved. You can now use the MCP server.');
  }

  /**
   * Navigate to the DZINE editor/app
   */
  async navigateToEditor(): Promise<void> {
    await this.initialize();
    await this.page!.goto(DZINE_APP_URL, { waitUntil: 'networkidle' });
  }

  /**
   * Wait for generation to complete and get results
   */
  private async waitForGeneration(timeoutMs: number = 120000): Promise<string[]> {
    const startTime = Date.now();
    const imageUrls: string[] = [];

    while (Date.now() - startTime < timeoutMs) {
      // Look for generated images in the canvas or output area
      const imageSelectors = [
        '.generated-image img',
        '.output-image img',
        '.result-image img',
        '[data-testid="generated-image"] img',
        '.canvas-container img',
        '.image-result img',
      ];

      for (const selector of imageSelectors) {
        try {
          const images = await this.page!.$$(selector);
          for (const img of images) {
            const src = await img.getAttribute('src');
            if (src && !imageUrls.includes(src)) {
              imageUrls.push(src);
            }
          }
        } catch {
          // Continue
        }
      }

      // Check for completion indicators
      const completionIndicators = [
        '.generation-complete',
        '[data-status="complete"]',
        '.success-message',
      ];

      for (const selector of completionIndicators) {
        try {
          const element = await this.page!.$(selector);
          if (element && imageUrls.length > 0) {
            return imageUrls;
          }
        } catch {
          // Continue
        }
      }

      // Check for errors
      const errorIndicators = [
        '.error-message',
        '[data-status="error"]',
        '.generation-failed',
      ];

      for (const selector of errorIndicators) {
        try {
          const element = await this.page!.$(selector);
          if (element) {
            const errorText = await element.textContent();
            throw new Error(`Generation failed: ${errorText}`);
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('Generation failed')) {
            throw e;
          }
        }
      }

      // Wait before next check
      await this.page!.waitForTimeout(2000);
    }

    if (imageUrls.length > 0) {
      return imageUrls;
    }

    throw new Error('Generation timed out');
  }

  /**
   * Generate image from text prompt
   */
  async textToImage(options: {
    prompt: string;
    negativePrompt?: string;
    style?: string;
    width?: number;
    height?: number;
  }): Promise<GenerationResult> {
    try {
      await this.initialize();
      await this.navigateToEditor();

      // Look for text-to-image or generation mode
      const modeSelectors = [
        'button:has-text("Text to Image")',
        '[data-tool="text-to-image"]',
        'button:has-text("Generate")',
        '[aria-label="Text to Image"]',
      ];

      for (const selector of modeSelectors) {
        try {
          const button = await this.page!.$(selector);
          if (button) {
            await button.click();
            await this.page!.waitForTimeout(500);
            break;
          }
        } catch {
          // Continue
        }
      }

      // Find and fill the prompt input
      const promptSelectors = [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="describe"]',
        'input[placeholder*="prompt"]',
        '[data-testid="prompt-input"]',
        '.prompt-input textarea',
        '.prompt-textarea',
      ];

      let promptFilled = false;
      for (const selector of promptSelectors) {
        try {
          const input = await this.page!.$(selector);
          if (input) {
            await input.fill(options.prompt);
            promptFilled = true;
            break;
          }
        } catch {
          // Continue
        }
      }

      if (!promptFilled) {
        return { success: false, error: 'Could not find prompt input field' };
      }

      // Fill negative prompt if provided
      if (options.negativePrompt) {
        const negativeSelectors = [
          'textarea[placeholder*="negative"]',
          '[data-testid="negative-prompt"]',
          '.negative-prompt textarea',
        ];

        for (const selector of negativeSelectors) {
          try {
            const input = await this.page!.$(selector);
            if (input) {
              await input.fill(options.negativePrompt);
              break;
            }
          } catch {
            // Continue
          }
        }
      }

      // Select style if provided
      if (options.style) {
        await this.selectStyle(options.style);
      }

      // Set dimensions if provided
      if (options.width || options.height) {
        await this.setDimensions(options.width, options.height);
      }

      // Click generate button
      const generateSelectors = [
        'button:has-text("Generate")',
        'button:has-text("Create")',
        '[data-testid="generate-button"]',
        '.generate-button',
        'button[type="submit"]',
      ];

      let generated = false;
      for (const selector of generateSelectors) {
        try {
          const button = await this.page!.$(selector);
          if (button) {
            await button.click();
            generated = true;
            break;
          }
        } catch {
          // Continue
        }
      }

      if (!generated) {
        return { success: false, error: 'Could not find generate button' };
      }

      // Wait for generation and get results
      const imageUrls = await this.waitForGeneration();

      return {
        success: true,
        imageUrls,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform an image based on a prompt
   */
  async imageToImage(options: {
    prompt: string;
    imagePath?: string;
    imageUrl?: string;
    strength?: number;
    style?: string;
  }): Promise<GenerationResult> {
    try {
      await this.initialize();
      await this.navigateToEditor();

      // Look for image-to-image mode
      const modeSelectors = [
        'button:has-text("Image to Image")',
        '[data-tool="image-to-image"]',
        'button:has-text("Transform")',
        '[aria-label="Image to Image"]',
      ];

      for (const selector of modeSelectors) {
        try {
          const button = await this.page!.$(selector);
          if (button) {
            await button.click();
            await this.page!.waitForTimeout(500);
            break;
          }
        } catch {
          // Continue
        }
      }

      // Upload image if path provided
      if (options.imagePath) {
        const uploadSelectors = [
          'input[type="file"]',
          '[data-testid="image-upload"]',
        ];

        for (const selector of uploadSelectors) {
          try {
            const input = await this.page!.$(selector);
            if (input) {
              await input.setInputFiles(options.imagePath);
              await this.page!.waitForTimeout(1000);
              break;
            }
          } catch {
            // Continue
          }
        }
      }

      // Fill prompt
      const promptSelectors = [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="describe"]',
        '[data-testid="prompt-input"]',
        '.prompt-input textarea',
      ];

      for (const selector of promptSelectors) {
        try {
          const input = await this.page!.$(selector);
          if (input) {
            await input.fill(options.prompt);
            break;
          }
        } catch {
          // Continue
        }
      }

      // Set strength/influence if provided
      if (options.strength !== undefined) {
        await this.setStrength(options.strength);
      }

      // Select style if provided
      if (options.style) {
        await this.selectStyle(options.style);
      }

      // Click generate
      const generateSelectors = [
        'button:has-text("Generate")',
        'button:has-text("Transform")',
        '[data-testid="generate-button"]',
      ];

      for (const selector of generateSelectors) {
        try {
          const button = await this.page!.$(selector);
          if (button) {
            await button.click();
            break;
          }
        } catch {
          // Continue
        }
      }

      const imageUrls = await this.waitForGeneration();

      return {
        success: true,
        imageUrls,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Apply style transfer
   */
  async styleTransfer(options: {
    contentImagePath?: string;
    styleImagePath?: string;
    styleIntensity?: number;
  }): Promise<GenerationResult> {
    try {
      await this.initialize();

      // Navigate to style transfer tool
      await this.page!.goto('https://www.dzine.ai/tools/style-transfer/', { waitUntil: 'networkidle' });

      // Upload content image
      if (options.contentImagePath) {
        const contentUploadSelectors = [
          '[data-testid="content-upload"] input[type="file"]',
          '.content-image input[type="file"]',
          'input[type="file"]',
        ];

        for (const selector of contentUploadSelectors) {
          try {
            const input = await this.page!.$(selector);
            if (input) {
              await input.setInputFiles(options.contentImagePath);
              await this.page!.waitForTimeout(1000);
              break;
            }
          } catch {
            // Continue
          }
        }
      }

      // Upload style image
      if (options.styleImagePath) {
        const styleUploadSelectors = [
          '[data-testid="style-upload"] input[type="file"]',
          '.style-image input[type="file"]',
        ];

        for (const selector of styleUploadSelectors) {
          try {
            const input = await this.page!.$(selector);
            if (input) {
              await input.setInputFiles(options.styleImagePath);
              await this.page!.waitForTimeout(1000);
              break;
            }
          } catch {
            // Continue
          }
        }
      }

      // Set style intensity
      if (options.styleIntensity !== undefined) {
        await this.setStrength(options.styleIntensity);
      }

      // Click apply/generate
      const applySelectors = [
        'button:has-text("Apply")',
        'button:has-text("Transfer")',
        'button:has-text("Generate")',
      ];

      for (const selector of applySelectors) {
        try {
          const button = await this.page!.$(selector);
          if (button) {
            await button.click();
            break;
          }
        } catch {
          // Continue
        }
      }

      const imageUrls = await this.waitForGeneration();

      return {
        success: true,
        imageUrls,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove background from image
   */
  async removeBackground(options: {
    imagePath: string;
  }): Promise<GenerationResult> {
    try {
      await this.initialize();

      // Navigate to background removal tool
      await this.page!.goto('https://www.dzine.ai/tools/background-remover/', { waitUntil: 'networkidle' });

      // Upload image
      const uploadSelectors = [
        'input[type="file"]',
        '[data-testid="image-upload"]',
      ];

      for (const selector of uploadSelectors) {
        try {
          const input = await this.page!.$(selector);
          if (input) {
            await input.setInputFiles(options.imagePath);
            await this.page!.waitForTimeout(2000);
            break;
          }
        } catch {
          // Continue
        }
      }

      // Wait for processing and get result
      const imageUrls = await this.waitForGeneration();

      return {
        success: true,
        imageUrls,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available styles
   */
  async getStyles(): Promise<StyleOption[]> {
    try {
      await this.initialize();
      await this.navigateToEditor();

      const styles: StyleOption[] = [];

      // Look for style picker/gallery
      const stylePickerSelectors = [
        '.style-picker',
        '[data-testid="style-gallery"]',
        '.style-gallery',
        'button:has-text("Styles")',
      ];

      for (const selector of stylePickerSelectors) {
        try {
          const picker = await this.page!.$(selector);
          if (picker) {
            await picker.click();
            await this.page!.waitForTimeout(500);
            break;
          }
        } catch {
          // Continue
        }
      }

      // Get style options
      const styleSelectors = [
        '.style-option',
        '[data-testid="style-item"]',
        '.style-card',
      ];

      for (const selector of styleSelectors) {
        try {
          const items = await this.page!.$$(selector);
          for (const item of items) {
            const name = await item.textContent();
            const id = await item.getAttribute('data-style-id') || name?.toLowerCase().replace(/\s+/g, '-') || '';
            if (name) {
              styles.push({ id, name: name.trim() });
            }
          }
          if (styles.length > 0) break;
        } catch {
          // Continue
        }
      }

      return styles;
    } catch {
      return [];
    }
  }

  /**
   * Download an image from URL
   */
  async downloadImage(url: string, outputPath: string): Promise<boolean> {
    try {
      await this.initialize();

      const response = await this.page!.request.get(url);
      const buffer = await response.body();
      fs.writeFileSync(outputPath, buffer);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Take a screenshot of current state
   */
  async screenshot(outputPath: string): Promise<boolean> {
    try {
      await this.initialize();
      await this.page!.screenshot({ path: outputPath, fullPage: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Select a style
   */
  private async selectStyle(styleName: string): Promise<void> {
    const styleSelectors = [
      `[data-style="${styleName}"]`,
      `[data-testid="style-${styleName}"]`,
      `button:has-text("${styleName}")`,
      `.style-option:has-text("${styleName}")`,
    ];

    for (const selector of styleSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element) {
          await element.click();
          await this.page!.waitForTimeout(300);
          return;
        }
      } catch {
        // Continue
      }
    }
  }

  /**
   * Helper: Set generation strength/influence
   */
  private async setStrength(strength: number): Promise<void> {
    const sliderSelectors = [
      'input[type="range"][name*="strength"]',
      '[data-testid="strength-slider"]',
      '.strength-slider input',
      'input[type="range"][name*="influence"]',
    ];

    for (const selector of sliderSelectors) {
      try {
        const slider = await this.page!.$(selector);
        if (slider) {
          await slider.fill(String(strength * 100));
          return;
        }
      } catch {
        // Continue
      }
    }
  }

  /**
   * Helper: Set image dimensions
   */
  private async setDimensions(width?: number, height?: number): Promise<void> {
    if (width) {
      const widthSelectors = [
        'input[name="width"]',
        '[data-testid="width-input"]',
      ];

      for (const selector of widthSelectors) {
        try {
          const input = await this.page!.$(selector);
          if (input) {
            await input.fill(String(width));
            break;
          }
        } catch {
          // Continue
        }
      }
    }

    if (height) {
      const heightSelectors = [
        'input[name="height"]',
        '[data-testid="height-input"]',
      ];

      for (const selector of heightSelectors) {
        try {
          const input = await this.page!.$(selector);
          if (input) {
            await input.fill(String(height));
            break;
          }
        } catch {
          // Continue
        }
      }
    }
  }
}
