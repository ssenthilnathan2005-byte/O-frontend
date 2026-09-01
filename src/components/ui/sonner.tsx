"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#1f2937",
          "--normal-border": "#e5e7eb",
          "--success-bg": "#ffffff",
          "--success-text": "#065f46",
          "--success-border": "#a7f3d0",
          "--error-bg": "#ffffff",
          "--error-text": "#991b1b",
          "--error-border": "#fecaca",
          "--warning-bg": "#ffffff",
          "--warning-text": "#92400e",
          "--warning-border": "#fde68a",
          "--info-bg": "#ffffff",
          "--info-text": "#1e40af",
          "--info-border": "#bfdbfe",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
