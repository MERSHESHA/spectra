import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Display-only countdown driven by authoritative endsAt.
 * Does not poll a server — only reads the local clock against endsAt.
 */
export function useExamTimer(endsAt) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );
  const [expired, setExpired] = useState(
    () => (endsAt ? Date.now() >= endsAt : false)
  );

  useEffect(() => {
    if (!endsAt) return undefined;

    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemainingMs(left);
      if (left <= 0) setExpired(true);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const formatTime = useCallback(() => {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remainingMs]);

  return { remainingMs, expired, formatTime };
}

/**
 * Request fullscreen for the exam container.
 * ESC always exits fullscreen (browser security). When an ACTIVE exam
 * unexpectedly leaves fullscreen, call onUnexpectedExit once (auto end-test).
 * Initial enter failures still show a warning so the student can re-enter.
 */
export function useExamFullscreen(enabled, onUnexpectedExit) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const wasFullscreenRef = useRef(false);
  const exitHandledRef = useRef(false);
  const onExitRef = useRef(onUnexpectedExit);
  onExitRef.current = onUnexpectedExit;

  const requestFs = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.();
      }
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
        setIsFullscreen(true);
        setShowWarning(false);
      }
    } catch {
      // Browser may block without a user gesture — show warning instead.
      setShowWarning(true);
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    setShowWarning(false);
    await requestFs();
  }, [requestFs]);

  useEffect(() => {
    if (!enabled) {
      wasFullscreenRef.current = false;
      exitHandledRef.current = false;
      return undefined;
    }

    let alive = true;

    // Already fullscreen from registration click gesture (documentElement).
    if (document.fullscreenElement) {
      wasFullscreenRef.current = true;
      setIsFullscreen(true);
      setShowWarning(false);
    }

    const onChange = () => {
      if (!alive) return;

      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      if (active) {
        wasFullscreenRef.current = true;
        setShowWarning(false);
        return;
      }

      // Only auto-end when an active exam that had entered fullscreen exits.
      if (
        wasFullscreenRef.current &&
        !exitHandledRef.current &&
        typeof onExitRef.current === "function"
      ) {
        exitHandledRef.current = true;
        setShowWarning(false);
        onExitRef.current();
      }
    };

    document.addEventListener("fullscreenchange", onChange);

    // Retry if registration fullscreen did not stick; may still need gesture.
    if (!document.fullscreenElement) {
      requestFs();
    }

    return () => {
      alive = false;
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, [enabled, requestFs]);

  // Soften disruptive shortcuts during exam (ESC cannot block FS exit).
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }

      if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);

  return {
    containerRef,
    isFullscreen,
    showWarning,
    enterFullscreen,
    dismissWarning: () => setShowWarning(false),
  };
}

/**
 * Detect leaving the exam tab/window via Page Visibility API.
 * visibilitychange is primary; blur only when the page is already hidden
 * (avoids false positives from normal in-page focus changes).
 */
export function useExamTabGuard(enabled, onLeave) {
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      firedRef.current = false;
      return undefined;
    }

    let alive = true;

    const trigger = () => {
      if (!alive || firedRef.current) return;
      if (typeof onLeaveRef.current !== "function") return;
      firedRef.current = true;
      onLeaveRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") trigger();
    };

    const onBlur = () => {
      // Supplementary only — ignore blur while the document is still visible.
      if (document.visibilityState === "hidden") trigger();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);
}
