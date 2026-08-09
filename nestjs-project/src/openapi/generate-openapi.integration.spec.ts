import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from './openapi.document';
import { generateOpenApiFile } from './generate-openapi';

describe('generateOpenApiFile', () => {
  const outputPath = join(tmpdir(), 'generate-openapi.integration-output.json');
  let app: INestApplication;

  afterEach(() => {
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('writes a parseable OpenAPI document whose path set matches the in-memory document', async () => {
    await generateOpenApiFile(outputPath);

    const written = JSON.parse(
      readFileSync(outputPath, 'utf-8'),
    ) as OpenAPIObject;

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    const inMemoryDocument = buildOpenApiDocument(app);

    expect(written.openapi).toBe('3.0.0');
    expect(Object.keys(written.paths).sort()).toEqual(
      Object.keys(inMemoryDocument.paths).sort(),
    );
  });
});
