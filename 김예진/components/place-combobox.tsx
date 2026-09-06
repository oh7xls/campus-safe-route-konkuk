"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PILOT_PLACES } from "@/lib/places";
import type { Place, SearchResponse } from "@/lib/types";

type PlaceComboboxProps = {
  label: string;
  marker: "start" | "end";
  value: Place;
  onChange: (place: Place) => void;
  onSelectionStateChange: (confirmed: boolean) => void;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function PlaceCombobox({
  label,
  marker,
  value,
  onChange,
  onSelectionStateChange,
}: PlaceComboboxProps) {
  const id = useId();
  const listboxId = `${id}-suggestions`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState(value.name);
  const [suggestions, setSuggestions] = useState(PILOT_PLACES.slice(0, 5));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queryEdited, setQueryEdited] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const restoreConfirmedValue = useCallback(() => {
    setQuery(value.name);
    setQueryEdited(false);
    setLoading(false);
    setOpen(false);
    setActiveIndex(-1);
    onSelectionStateChange(true);
  }, [onSelectionStateChange, value.name]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        restoreConfirmedValue();
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [restoreConfirmedValue]);

  useEffect(() => {
    if (!queryEdited) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchResponse;

        if (requestId === requestIdRef.current) {
          setSuggestions(payload.places);
          setActiveIndex(-1);
        }
      } catch (error) {
        if (!isAbortError(error) && requestId === requestIdRef.current) {
          setSuggestions(PILOT_PLACES.slice(0, 5));
          setActiveIndex(-1);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      if (requestId === requestIdRef.current) {
        requestIdRef.current += 1;
      }
    };
  }, [query, queryEdited]);

  function selectPlace(place: Place) {
    setQuery(place.name);
    setQueryEdited(false);
    setLoading(false);
    onChange(place);
    onSelectionStateChange(true);
    setOpen(false);
    setActiveIndex(-1);
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (!suggestions.length) return;

    setOpen(true);
    setActiveIndex((current) => {
      if (current < 0) {
        return direction === 1 ? 0 : suggestions.length - 1;
      }

      return (current + direction + suggestions.length) % suggestions.length;
    });
  }

  const activeOptionId =
    open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="place-field" ref={rootRef}>
      <span className={`place-marker ${marker}`} aria-hidden="true">
        <span>{marker === "start" ? "A" : "B"}</span>
      </span>
      <div className="place-input-wrap">
        <label htmlFor={id}>{label}</label>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setQueryEdited(true);
            setOpen(true);
            setActiveIndex(-1);
            onSelectionStateChange(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
              restoreConfirmedValue();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveIndex(1);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveIndex(-1);
              return;
            }

            if (event.key === "Enter" && activeIndex >= 0) {
              const selected = suggestions[activeIndex];
              if (selected) {
                event.preventDefault();
                selectPlace(selected);
              }
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              restoreConfirmedValue();
              inputRef.current?.select();
            }
          }}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
        />
        {loading ? <span className="field-spinner" aria-label="검색 중" /> : null}
      </div>

      {open ? (
        <div className="suggestion-list" id={listboxId} role="listbox">
          {suggestions.length ? (
            suggestions.map((place, index) => (
              <button
                id={`${listboxId}-option-${index}`}
                key={place.id}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectPlace(place)}
              >
                <span className="suggestion-icon" aria-hidden="true">
                  {place.source === "pilot" ? "P" : "T"}
                </span>
                <span>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty-suggestion">파일럿 지역에서 검색 결과가 없습니다.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
