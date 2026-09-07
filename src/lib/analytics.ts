import posthog from "posthog-js";

let initialized = false;

// Test user emails for internal testing
const TEST_USER_EMAILS = ["maxflexteam@gmail.com"];

export function isTestUser(email: string | undefined | null): boolean {
  if (!email) return false;
  return TEST_USER_EMAILS.includes(email.toLowerCase());
}

function host(): string {
  const region = (import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] as string) || "eu";
  return region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";
}

/** Initializes PostHog once in the browser. Safe to call from React effects. */
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"] as string | undefined;
  if (!token) return;
  posthog.init(token, {
    api_host: host(),
    capture_pageview: true,
    autocapture: true,
    disable_session_recording: false,
  });
  initialized = true;
}

export function deviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && width < 768) return "mobile";
  if (touch) return "tablet";
  return "desktop";
}

export type AnalyticsEvent =
  | "sign_up"
  | "game_generation_started"
  | "game_played"
  | "game_edited"
  | "game_saved"
  | "fullscreen_used"
  | "daily_limit_reached"
  | "unsupported_game_type";

/** Captures a product event. Never send prompts or other sensitive content. */
export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  initAnalytics();
  if (!initialized) return;
  posthog.capture(event, { device_type: deviceType(), ...properties });
}

export function identifyUser(userId: string, isInternalTestUser: boolean = false) {
  if (typeof window === "undefined") return;
  initAnalytics();
  if (!initialized) return;
  posthog.identify(userId);
  if (isInternalTestUser) {
    posthog.people.set({ $internal_or_test_user: true });
  }
}
