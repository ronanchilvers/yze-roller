import { useCallback, useState } from "react";
import {
  parseCharacterImport,
  parseCharacterJson,
} from "../lib/character-import.js";

const createInitialState = () => ({
  fileName: "",
  status: "idle", // idle | loading | ready | error
  character: null,
  selectedAttribute: null,
  selectedSkill: null,
  errors: [],
  warnings: [],
});

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(new Error("Unable to read the selected file."));
    reader.readAsText(file);
  });

export const useCharacterImport = () => {
  const [state, setState] = useState(createInitialState);

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const applyImport = useCallback((payload, fileName = "") => {
    const result = parseCharacterImport(payload);
    if (!result.isValid) {
      setState({
        fileName,
        status: "error",
        character: null,
        selectedAttribute: null,
        selectedSkill: null,
        errors: result.errors,
        warnings: result.warnings,
      });
      return;
    }

    const defaultAttribute =
      Object.keys(result.character?.attributes ?? {})[0] ?? null;

    setState({
      fileName,
      status: "ready",
      character: result.character,
      selectedAttribute: defaultAttribute,
      selectedSkill: null,
      errors: [],
      warnings: result.warnings,
    });
  }, []);

  const importFromFile = useCallback(
    async (file) => {
      if (!file) {
        reset();
        return;
      }

      setState((current) => ({
        ...current,
        status: "loading",
        errors: [],
        warnings: [],
      }));

      try {
        const text = await readFileAsText(file);
        const parsed = parseCharacterJson(text);

        if (parsed.error) {
          setState({
            fileName: file.name ?? "",
            status: "error",
            character: null,
            selectedAttribute: null,
            selectedSkill: null,
            errors: [parsed.error],
            warnings: [],
          });
          return;
        }

        applyImport(parsed.data, file.name ?? "");
      } catch (error) {
        setState({
          fileName: file.name ?? "",
          status: "error",
          character: null,
          selectedAttribute: null,
          selectedSkill: null,
          errors: [
            error?.message ? String(error.message) : "Unable to import file.",
          ],
          warnings: [],
        });
      }
    },
    [applyImport, reset],
  );

  const setSelectedAttribute = useCallback((value) => {
    setState((current) => ({
      ...current,
      selectedAttribute: value,
    }));
  }, []);

  const setSelectedSkill = useCallback((value) => {
    setState((current) => ({
      ...current,
      selectedSkill: value,
    }));
  }, []);

  return {
    ...state,
    importFromFile,
    applyImport,
    reset,
    setSelectedAttribute,
    setSelectedSkill,
  };
};