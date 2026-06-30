import "reflect-metadata";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { NextFunction, Request, Response } from "express";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { SanitizeInterceptor } from "./common/interceptors/sanitize.interceptor";

const rateLimitWindowMs = 60_000;
const rateLimitMax = 120;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const isProduction = config.get("NODE_ENV") === "production";

  app.use(pinoHttp({ redact: ["req.headers.authorization", "req.headers.cookie"] }));
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      requestBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > rateLimitMax) {
      response.status(429).json({ message: "Too many requests" });
      return;
    }
    next();
  });
  app.use(cookieParser(config.getOrThrow<string>("COOKIE_SECRET")));
  app.enableCors({
    origin: config.getOrThrow<string>("FRONTEND_URL"),
    credentials: true
  });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SanitizeInterceptor());

  if (isProduction) app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT") ?? 4000);
}

void bootstrap();
