"use client";

import { FormEvent, useEffect, useState } from "react";
import type { TutorListing, TutorSubject } from "@/lib/tutor-market";

type FormState = {
  name: string;
  subject: TutorSubject;
  pricePerHour: string;
  rating: string;
  about: string;
  city: string;
  experienceYears: string;
};

const initialForm: FormState = {
  name: "",
  subject: "math",
  pricePerHour: "1500",
  rating: "4.8",
  about: "",
  city: "",
  experienceYears: "3",
};

export function AdminTutorManager() {
  const [items, setItems] = useState<TutorListing[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/admin/tutors", { cache: "no-store" });
      const data = (await response.json().catch(() => ({ tutors: [] }))) as { tutors: TutorListing[] };
      setItems(data.tutors ?? []);
    }
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/tutors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          subject: form.subject,
          pricePerHour: Number(form.pricePerHour),
          rating: Number(form.rating),
          about: form.about.trim(),
          city: form.city.trim(),
          experienceYears: Number(form.experienceYears),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { tutor?: TutorListing; error?: string };
      if (!response.ok || !data.tutor) {
        setStatus(data.error ?? "Не удалось создать объявление");
        return;
      }
      const tutor = data.tutor;
      setItems((current) => [...current, tutor]);
      setForm(initialForm);
      setStatus("Объявление добавлено.");
    } catch {
      setStatus("Сетевая ошибка. Повторите попытку.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel-accent space-y-4">
      <h2>Репетиторы (тестовый маркет)</h2>
      <p className="text-sm text-slate-700">Объявления публикуются только из админки. Сейчас это MVP-режим с демо-данными.</p>

      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <input
          type="text"
          placeholder="Имя репетитора"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Город"
          value={form.city}
          onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
          required
        />
        <select
          value={form.subject}
          onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value as TutorSubject }))}
        >
          <option value="math">Математика</option>
          <option value="physics">Физика</option>
        </select>
        <input
          type="number"
          min={500}
          max={20000}
          step={100}
          placeholder="Цена в час"
          value={form.pricePerHour}
          onChange={(event) => setForm((current) => ({ ...current, pricePerHour: event.target.value }))}
          required
        />
        <input
          type="number"
          min={1}
          max={5}
          step={0.1}
          placeholder="Рейтинг"
          value={form.rating}
          onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}
          required
        />
        <input
          type="number"
          min={0}
          max={60}
          step={1}
          placeholder="Стаж (лет)"
          value={form.experienceYears}
          onChange={(event) => setForm((current) => ({ ...current, experienceYears: event.target.value }))}
          required
        />
        <textarea
          className="md:col-span-2"
          placeholder="Описание и формат занятий"
          value={form.about}
          onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
          required
        />
        <button type="submit" className="btn-primary md:col-span-2" disabled={loading}>
          {loading ? "Публикуем..." : "Добавить объявление"}
        </button>
      </form>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <ul className="space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            {item.name} • {item.subject === "math" ? "Математика" : "Физика"} • {item.pricePerHour} ₽/час • рейтинг {item.rating.toFixed(1)}
          </li>
        ))}
      </ul>
    </section>
  );
}
