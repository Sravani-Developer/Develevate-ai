import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";
import { Observable } from "rxjs";

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ body?: unknown; query?: unknown; params?: unknown }>();
    request.body = sanitize(request.body);
    request.query = sanitize(request.query);
    request.params = sanitize(request.params);
    return next.handle();
  }
}
