import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";

function stripPrefix(req: Request, _res: Response, next: NextFunction): void {
  if (req.path.startsWith("/shop/")) {
    req.url = req.url.replace(/^\/shop/, "") || "/";
  }
  next();
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(stripPrefix);

  const corsOrigin =
    config.get<string>("CORS_ORIGIN") ??
    process.env.CORS_ORIGIN ??
    "*";
  
  app.enableCors({
    origin:
      corsOrigin === "*"
        ? true
        : corsOrigin.split(",").map((item) => item.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Tenant-Domain",
      "Referer",
      "User-Agent",
    ],
  });

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

bootstrap();
