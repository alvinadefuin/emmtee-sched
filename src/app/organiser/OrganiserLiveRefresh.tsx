"use client";

import { useCallback, useEffect, useRef } from "react";
import { LiveRefresh } from "@/app/components/LiveRefresh";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isField = (el: Element | null): el is Field =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/** True when a control differs from the value the server rendered into it. */
function fieldChanged(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === "hidden" || el.type === "submit" || el.type === "button") return false;
    if (el.type === "checkbox" || el.type === "radio") return el.checked !== el.defaultChecked;
    return el.value !== el.defaultValue;
  }
  if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
  if (el instanceof HTMLSelectElement) return Array.from(el.options).some((o) => o.selected !== o.defaultSelected);
  return false;
}

const formChanged = (form: HTMLFormElement) => Array.from(form.elements).some(fieldChanged);

/**
 * Live refresh for the organiser page that never pulls the page out from under an
 * edit: a refresh waits while focus is in a form field or any form has unsaved
 * changes, and is applied once the organiser saves, reverts or leaves the field.
 */
export function OrganiserLiveRefresh({ url }: { url: string }) {
  // Forms the organiser has typed into since they were last submitted.
  const dirty = useRef(new Set<HTMLFormElement>());

  useEffect(() => {
    const forms = dirty.current;
    const onInput = (e: Event) => {
      const form = isField(e.target as Element) ? (e.target as Field).form : null;
      if (form) forms.add(form);
    };
    const onSubmit = (e: Event) => {
      if (e.target instanceof HTMLFormElement) forms.delete(e.target);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      forms.clear();
    };
  }, []);

  const pauseWhile = useCallback(() => {
    if (isField(document.activeElement) && document.activeElement.type !== "hidden") return true;
    for (const form of dirty.current) {
      // Forget forms that left the page or whose values are back to what the server sent.
      if (!form.isConnected || !formChanged(form)) dirty.current.delete(form);
    }
    return dirty.current.size > 0;
  }, []);

  return <LiveRefresh url={url} pauseWhile={pauseWhile} />;
}
