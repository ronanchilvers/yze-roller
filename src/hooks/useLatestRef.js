import { useEffect, useRef } from "react";

/**
 * Creates a ref that always contains the latest value.
 * Useful for accessing current state in callbacks without stale closures.
 *
 * @template T
 * @param {T} value - The value to keep in sync
 * @returns {React.MutableRefObject<T>} A ref containing the latest value
 */
export const useLatestRef = (value) => {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
};
