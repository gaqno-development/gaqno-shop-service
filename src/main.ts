import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { getCorsOptions } from "@gaqno-development/backcore";
import { runMigrations } from "./database/migrate";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const configService = new ConfigService();
  const databaseUrl = configService.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL ?? "";
  
  if (databaseUrl) {
    await runMigrations(databaseUrl);
  } else {
    console.warn("⚠️  DATABASE_URL not set, skipping migrations");
  }
  
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.enableCors(getCorsOptions(config as unknown as Parameters<typeof getCorsOptions>[0]));

  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true,
  }));

  const port = config.get<number>("PORT") ?? 4017;
  await app.listen(port);
  
  console.log(`🚀 Shop Service is running on: http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/v1`);
  console.log(`🛍️  Multi-tenant shop platform ready!`);
}

bootstrap().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});
