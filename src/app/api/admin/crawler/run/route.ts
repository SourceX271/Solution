import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST() {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const crawlerPath = path.join(process.cwd(), "crawler", "main.py");

    try {
      const { stdout, stderr } = await execAsync(`python "${crawlerPath}"`, {
        timeout: 120000,
      });

      return NextResponse.json({
        status: "success",
        message: "爬虫任务已完成",
        output: stdout,
        ...(stderr && { stderr }),
      });
    } catch (execError: any) {
      return NextResponse.json({
        status: "error",
        message: "爬虫任务执行失败",
        error: execError.message,
        ...(execError.stdout && { stdout: execError.stdout }),
        ...(execError.stderr && { stderr: execError.stderr }),
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "触发爬虫失败" }, { status: 500 });
  }
}
