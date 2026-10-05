import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 站点标志。源文件位于 public/logo.svg：
 * 已移除原稿的白色底板，并把 viewBox 收紧到图形边界，因此在浅色/深色
 * 背景上都是透明底、无多余留白。尺寸通过 className 控制（如 "h-8 w-8"）。
 */
export function Logo({
  className,
  alt = "",
  priority = false,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.svg"
      alt={alt}
      width={64}
      height={64}
      priority={priority}
      unoptimized
      className={cn("shrink-0 select-none", className)}
    />
  );
}
