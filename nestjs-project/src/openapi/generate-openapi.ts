import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './openapi.document';

export const OPENAPI_OUTPUT_PATH = join(__dirname, '..', '..', 'openapi.json');

/**
 * Generates the versioned OpenAPI document on demand. Boots the app context
 * (needs Postgres, Mailpit and every required env var reachable) with no
 * HTTP listener, writes the file, and closes the app.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 * @param outputPath - destination file path (defaults to `nestjs-project/openapi.json`)
 */
export async function generateOpenApiFile(
  outputPath: string = OPENAPI_OUTPUT_PATH,
): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n');
  await app.close();
}

if (require.main === module) {
  void generateOpenApiFile();
}
