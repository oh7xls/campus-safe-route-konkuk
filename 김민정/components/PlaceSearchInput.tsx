'use client';

import { useEffect, useState } from 'react';

export type PlacePoint = {
  name: string;
  lng: number;
  lat: number;
};

type PlaceSearchItem = {
  name: string;
  address: string;
  mapx: string;
  mapy: string;
};

type Props = {
  label: string;
  value: PlacePoint | null;
  onSelect: (point: PlacePoint) => void;
  onClearSelection: () => void;
};

export default function PlaceSearchInput({
  label,
  value,
  onSelect,
  onClearSelection,
}: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [items, setItems] = useState<PlaceSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.name]);

  useEffect(() => {
    const keyword = query.trim();

    if (keyword.length < 2 || value?.name === keyword) {
      setItems([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/places?q=${encodeURIComponent(keyword)}`
        );

        const result = await response.json();

        setItems(Array.isArray(result.items) ? result.items : []);
        setIsOpen(true);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query, value?.name]);

  const choosePlace = (item: PlaceSearchItem) => {
    /*
      네이버 지역검색 API의 mapx/mapy는
      경도·위도에 10,000,000을 곱한 정수 형태입니다.
    */
    const point = {
      name: item.name,
      lng: Number(item.mapx) / 10_000_000,
      lat: Number(item.mapy) / 10_000_000,
    };

    onSelect(point);
    setQuery(item.name);
    setItems([]);
    setIsOpen(false);
  };

  return (
    <label className="place-search">
      {label}

      <div className="place-search-wrap">
        <input
          value={query}
          placeholder={`${label}를 검색하세요`}
          autoComplete="off"
          onFocus={() => {
            if (items.length > 0) {
              setIsOpen(true);
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onClearSelection();
          }}
        />

        {isLoading && <span className="search-status">검색 중…</span>}

        {isOpen && items.length > 0 && (
          <ul className="place-results">
            {items.map((item) => (
              <li key={`${item.name}-${item.mapx}-${item.mapy}`}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    /*
                      input의 blur보다 먼저 선택 이벤트가 실행되도록 처리합니다.
                    */
                    event.preventDefault();
                    choosePlace(item);
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{item.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {isOpen && !isLoading && query.trim().length >= 2 && items.length === 0 && (
          <div className="place-no-result">검색 결과가 없습니다.</div>
        )}
      </div>
    </label>
  );
}
