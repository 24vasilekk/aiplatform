"use client";

import { useEffect, useMemo, useState } from "react";
import type { TutorListing, TutorSubject } from "@/lib/tutor-market";

type SortMode = "price_asc" | "price_desc" | "rating_desc";

const favoriteStorageKey = "ege_tutor_favorites_v1";

function subjectLabel(subject: TutorSubject) {
  return subject === "math" ? "Математика" : "Физика";
}

export function TutorsMarket() {
  const [tutors, setTutors] = useState<TutorListing[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<"all" | TutorSubject>("all");
  const [sort, setSort] = useState<SortMode>("rating_desc");
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = window.localStorage.getItem(favoriteStorageKey);
    if (!saved) return [];

    try {
      const ids = JSON.parse(saved) as string[];
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/tutors", { cache: "no-store" });
      const data = (await response.json().catch(() => ({ tutors: [] }))) as { tutors: TutorListing[] };
      setTutors(data.tutors ?? []);
    }

    void load();
  }, []);

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      globalThis.localStorage?.setItem(favoriteStorageKey, JSON.stringify(next));
      return next;
    });
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = tutors.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.about.toLowerCase().includes(query) ||
        item.city.toLowerCase().includes(query)
      );
    });
    const bySubject = bySearch.filter((item) => (subject === "all" ? true : item.subject === subject));
    const sorted = [...bySubject];

    sorted.sort((a, b) => {
      if (sort === "price_asc") return a.pricePerHour - b.pricePerHour;
      if (sort === "price_desc") return b.pricePerHour - a.pricePerHour;
      return b.rating - a.rating;
    });

    return sorted;
  }, [search, sort, subject, tutors]);

  return (
    <section className="space-y-4">
      <h1>Маркет Репетиторов</h1>
      <p className="text-sm text-slate-700">Тестовый режим: объявления добавляются только через админку.</p>

      <div className="card-soft grid gap-3 p-4 md:grid-cols-4">
        <input
          type="search"
          placeholder="Поиск по имени, городу, описанию"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:col-span-2"
        />
        <select value={subject} onChange={(event) => setSubject(event.target.value as "all" | TutorSubject)}>
          <option value="all">Все предметы</option>
          <option value="math">Математика</option>
          <option value="physics">Физика</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="rating_desc">Сначала по рейтингу</option>
          <option value="price_asc">Цена: по возрастанию</option>
          <option value="price_desc">Цена: по убыванию</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tutor) => (
          <article key={tutor.id} className="card-soft flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2>{tutor.name}</h2>
                <p className="text-sm text-slate-700">{subjectLabel(tutor.subject)} • {tutor.city}</p>
              </div>
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => toggleFavorite(tutor.id)}>
                {favorites.includes(tutor.id) ? "В избранном" : "В избранное"}
              </button>
            </div>

            <p className="text-sm text-slate-800">{tutor.about}</p>
            <p className="text-sm text-slate-700">Опыт: {tutor.experienceYears} лет</p>
            <p className="text-sm text-slate-900">Цена: {tutor.pricePerHour} ₽/час</p>
            <p className="text-sm text-slate-900">Рейтинг: {tutor.rating.toFixed(1)} / 5</p>

            <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-800">Отзывы</p>
              <ul className="space-y-2">
                {(tutor.reviews.length > 0 ? tutor.reviews : [{ id: `${tutor.id}-empty`, author: "—", rating: tutor.rating, text: "Пока отзывов нет." }]).map((review) => (
                  <li key={review.id} className="text-xs text-slate-700">
                    <p className="font-medium">{review.author} • {review.rating.toFixed(1)}</p>
                    <p>{review.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
