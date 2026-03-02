export const copyTextToClipboard = async (text) => {
  const normalizedText = typeof text === "string" ? text.trim() : "";

  if (!normalizedText) {
    return false;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(normalizedText);
      return true;
    } catch {
      // Fallback path below handles environments without clipboard permission.
    }
  }

  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = normalizedText;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return Boolean(document.execCommand?.("copy"));
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};
