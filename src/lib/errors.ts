import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { auth } from "@/lib/auth";
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
    try {
      // Auth check
      const session = (await auth()) as AuthSession | null;

      if (config.auth === "required" && !session) {
        return NextResponse.json(
          { success: false, error: "请先登录" },
          { status: 401 }
        );
      }

      if (config.auth === "admin") {
        if (!session) {
          return NextResponse.json(
            { success: false, error: "请先登录" },
            { status: 401 }
          );
        }
        if (session.user.role !== "ADMIN") {
          return NextResponse.json(
            { success: false, error: "无权限" },
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
        { success: false, error: "服务器内部错误" },
        { status: 500 }
      );
    }
  };
}

// Helpers
export function getPaginationParams(req: NextRequest): { page: number; limit: number; skip: number } {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "10")));
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
