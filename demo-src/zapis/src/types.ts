export type Service = {
  id: number;
  name: string;
  description: string;
  duration: number;
  price: string;
  active: boolean;
};
export type Barber = {
  id: number;
  name: string;
  description: string;
  photo: string;
  active: boolean;
  service_ids: number[];
};
export type Appointment = {
  id: string;
  barber_id: number;
  barber_name: string;
  barber_photo: string;
  service_id: number;
  service_name: string;
  starts_at: string;
  ends_at: string;
  price: string;
  duration: number;
  client_name: string;
  phone: string | null;
  status: string;
  version: number;
  notification: string;
  can_change: boolean;
  change_reason: string;
};
export type Config = {
  demo_mode: boolean;
  portfolio_mode: boolean;
  portfolio_booking_limit: number;
  bot_url: string | null;
  timezone: string;
  change_cutoff_hours: number;
};
export type User = {
  name: string;
  csrf: string;
  can_message: boolean;
  demo: boolean;
};
export type Schedule = {
  hours: { weekday: number; start: string; end: string; kind: string }[];
  exceptions: {
    day: string;
    start: string | null;
    end: string | null;
    kind: string;
  }[];
};
export type TelegramApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor: (s: string) => void;
  setBackgroundColor: (s: string) => void;
  setBottomBarColor?: (s: string) => void;
  isVersionAtLeast: (v: string) => boolean;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  requestWriteAccess?: (cb: (allowed: boolean) => void) => void;
  onEvent: (s: string, cb: () => void) => void;
  offEvent: (s: string, cb: () => void) => void;
  safeAreaInset?: { top: number; bottom: number };
  contentSafeAreaInset?: { top: number; bottom: number };
  viewportStableHeight?: number;
  HapticFeedback?: { notificationOccurred: (s: string) => void };
};
declare global {
  interface Window {
    Telegram?: { WebApp: TelegramApp };
  }
}


