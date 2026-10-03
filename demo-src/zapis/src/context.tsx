import { createContext, useContext } from "react";
import type { Config, User } from "./types";

export const AppContext = createContext<{ config: Config; user?: User }>({
  config: {
    demo_mode: false,
    portfolio_mode: false,
    portfolio_booking_limit: 3,
    bot_url: null,
    timezone: "Europe/Moscow",
    change_cutoff_hours: 2,
  },
});
export const useApp = () => useContext(AppContext);


