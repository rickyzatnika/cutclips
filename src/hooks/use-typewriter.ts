"use client";

import { useState, useEffect } from "react";

export function useTypewriter(text: string, speed: number) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (!text) return;
    const interval = setInterval(() => {
      setIdx((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return text.slice(0, idx);
}
