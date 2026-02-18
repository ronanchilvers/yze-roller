import { useContext } from "react";
import { ToastContext } from "../components/toast/ToastProvider.jsx";

const fallbackToast = Object.freeze({
  alert: () => null,
  diceResult: () => null,
  confirm: () => Promise.resolve(false),
});

const IS_DEV = Boolean(import.meta?.env?.DEV);
let didWarnMissingProvider = false;

export const __IS_DEV_USE_TOAST = IS_DEV;

export const __resetUseToastWarningForTests = () => {
  didWarnMissingProvider = false;
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context) {
    return context;
  }

  if (IS_DEV && !didWarnMissingProvider) {
    didWarnMissingProvider = true;
    console.warn(
      "useToast called outside ToastProvider. Returning no-op handlers.",
    );
  }

  return fallbackToast;
};

