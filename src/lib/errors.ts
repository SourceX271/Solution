import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { AuthSession } from "@/lib/types";

// AppError
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Route handler config
interface HandlerConfig {
  auth?: "required" | "admin" | "optional";
  validate?: ZodSchema;
}

type HandlerFn = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>>; session?: AuthSession }
) => Promise<NextResponse>;

// apiHandler
export function apiHandler(config: HandlerConfig, handler: HandlerFn) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const t = await getApiT("api");
    try {
      // Auth check
      const session = (await auth()) as AuthSession | null;

      if (config.auth === "required" && !session) {
        return NextResponse.json(
          { success: false, error: t("unauthorized") },
          { status: 401 }
        );
      }

      if (config.auth === "admin") {
        if (!session) {
          return NextResponse.json(
            { success: false, error: t("unauthorized") },
            { status: 401 }
          );
        }
        if (session.user.role !== "ADMIN") {
          return NextResponse.json(
            { success: false, error: t("forbidden") },
            { status: 403 }
          );
        }
      }

      // Validation
      if (config.validate && ["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          const body = await req.clone().json();
          config.validate.parse(body);
        } catch (e) {
          if (e instanceof ZodError) {
            return NextResponse.json(
              { success: false, error: e.errors[0].message },
              { status: 400 }
            );
          }
          throw e;
        }
      }

      return handler(req, {
        params: routeCtx.params,
        session: session ?? undefined,
      });
    } catch (error: unknown) {
      // Re-throw Next.js internal errors
      if (error instanceof Error) {
        const err = error as Error & { digest?: string };
        if (
          err.digest === "DYNAMIC_SERVER_USAGE" ||
          err.digest === "NEXT_DYNAMIC_NO_SSR" ||
          (err.digest && err.digest.startsWith("NEXT_REDIRECT"))
        ) {
          throw error;
        }
      }

      if (error instanceof AppError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.statusCode }
        );
      }

      console.error("Unhandled API error:", error);
      return NextResponse.json(
        { success: false, error: t("serverError") },
        { status: 500 }
      );
    }
  };
}

// Helpers

/**
 * Parse a positive integer safely.
 *
 * `parseInt` returns NaN for garbage input (e.g. ?page=abc) and NaN propagates
 * into Prisma's `skip`/`take`, which throws a 500. Always fall back to a
 * sensible default instead.
 */
export function toPositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

export function getPaginationParams(req: NextRequest): { page: number; limit: number; skip: number } {
  const url = new URL(req.url);
  const page = toPositiveInt(url.searchParams.get("page"), 1);
  const limit = toPositiveInt(url.searchParams.get("limit"), 10, 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
