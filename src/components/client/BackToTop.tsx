"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { useTranslations } from "next-intl"

export function BackToTop() {
  const t = useTranslations("common")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <button
      onClick={scrollToTop}
      className={`back-to-top ${visible ? "visible" : ""}`}
      aria-label={t("backToTop")}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  )
}
