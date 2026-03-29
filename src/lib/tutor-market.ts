import { promises as fs } from "node:fs";
import path from "node:path";

export type TutorSubject = "math" | "physics";

export type TutorReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
};

export type TutorListing = {
  id: string;
  name: string;
  subject: TutorSubject;
  pricePerHour: number;
  rating: number;
  about: string;
  city: string;
  experienceYears: number;
  reviews: TutorReview[];
  createdAt: string;
};

type TutorStore = {
  tutors: TutorListing[];
};

const DEMO_TUTORS: TutorListing[] = [
  {
    id: "tutor-demo-1",
    name: "Анна Крылова",
    subject: "math",
    pricePerHour: 1800,
    rating: 4.9,
    about: "Помогаю с профильной математикой ЕГЭ: задания 13-19, делаю акцент на логике решения.",
    city: "Москва",
    experienceYears: 7,
    reviews: [
      { id: "r-1", author: "Мария", rating: 5, text: "Очень понятно объясняет, результат вырос за 2 месяца." },
      { id: "r-2", author: "Илья", rating: 5, text: "Хорошо разбирает ошибки и дает четкий план подготовки." },
    ],
    createdAt: "2026-03-29T09:00:00.000Z",
  },
  {
    id: "tutor-demo-2",
    name: "Игорь Сорокин",
    subject: "physics",
    pricePerHour: 1600,
    rating: 4.7,
    about: "Физика ЕГЭ без зубрежки: учу понимать задачи по механике и электродинамике.",
    city: "Санкт-Петербург",
    experienceYears: 5,
    reviews: [
      { id: "r-3", author: "Ольга", rating: 5, text: "Сын начал решать вторую часть, раньше боялся ее." },
      { id: "r-4", author: "Дмитрий", rating: 4, text: "Стало меньше глупых ошибок, появилась уверенность." },
    ],
    createdAt: "2026-03-29T09:05:00.000Z",
  },
  {
    id: "tutor-demo-3",
    name: "Екатерина Власова",
    subject: "math",
    pricePerHour: 2200,
    rating: 5,
    about: "Индивидуальные занятия для 80+ баллов, еженедельный трекер прогресса и домашние разборы.",
    city: "Казань",
    experienceYears: 10,
    reviews: [
      { id: "r-5", author: "Алина", rating: 5, text: "Подготовка очень структурная, всё по полочкам." },
      { id: "r-6", author: "Никита", rating: 5, text: "С 62 до 88 баллов за учебный год, супер опыт." },
    ],
    createdAt: "2026-03-29T09:10:00.000Z",
  },
  {
    id: "tutor-demo-4",
    name: "Максим Беляев",
    subject: "physics",
    pricePerHour: 1400,
    rating: 4.6,
    about: "Разбираем физику ЕГЭ от базы до сложных задач: акцент на понимание формул и практику.",
    city: "Новосибирск",
    experienceYears: 4,
    reviews: [
      { id: "r-7", author: "Тимур", rating: 5, text: "Стало проще понимать задачи на динамику и импульс." },
      { id: "r-8", author: "София", rating: 4, text: "Хороший темп занятий, много полезных мини-тестов." },
    ],
    createdAt: "2026-03-29T09:15:00.000Z",
  },
  {
    id: "tutor-demo-5",
    name: "Полина Громова",
    subject: "math",
    pricePerHour: 1950,
    rating: 4.8,
    about: "Готовлю к профильной математике: план по темам, разбор типичных ошибок, контроль прогресса.",
    city: "Екатеринбург",
    experienceYears: 6,
    reviews: [
      { id: "r-9", author: "Вера", rating: 5, text: "Очень структурно, стало легче решать 17 и 18 задания." },
      { id: "r-10", author: "Роман", rating: 4.5, text: "Понравилась система домашек и обратной связи." },
    ],
    createdAt: "2026-03-29T09:20:00.000Z",
  },
  {
    id: "tutor-demo-6",
    name: "Артем Мельников",
    subject: "physics",
    pricePerHour: 2100,
    rating: 5,
    about: "Подготовка на высокие баллы: подробные разборы второй части и стратегия на экзамене.",
    city: "Нижний Новгород",
    experienceYears: 9,
    reviews: [
      { id: "r-11", author: "Егор", rating: 5, text: "Занятия супер, теперь уверенно решаю вторую часть." },
      { id: "r-12", author: "Лиза", rating: 5, text: "Четкие объяснения, всё по делу и без воды." },
    ],
    createdAt: "2026-03-29T09:25:00.000Z",
  },
];

async function ensureStorePath() {
  const dir = path.join(process.cwd(), ".tmp");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "tutors-market.json");
}

async function loadStore(): Promise<TutorStore> {
  const storePath = await ensureStorePath();

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const data = JSON.parse(raw) as TutorStore;
    if (!Array.isArray(data.tutors)) {
      throw new Error("invalid store");
    }
    const existingIds = new Set(data.tutors.map((item) => item.id));
    const missingDemoTutors = DEMO_TUTORS.filter((item) => !existingIds.has(item.id));
    if (missingDemoTutors.length > 0) {
      const patched: TutorStore = {
        tutors: [...data.tutors, ...missingDemoTutors],
      };
      await saveStore(patched);
      return patched;
    }
    return data;
  } catch {
    const initial: TutorStore = { tutors: DEMO_TUTORS };
    await fs.writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function saveStore(data: TutorStore) {
  const storePath = await ensureStorePath();
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

export async function listTutorListings() {
  const store = await loadStore();
  return [...store.tutors].sort((a, b) => a.pricePerHour - b.pricePerHour);
}

export async function createTutorListing(input: {
  name: string;
  subject: TutorSubject;
  pricePerHour: number;
  rating: number;
  about: string;
  city: string;
  experienceYears: number;
}) {
  const store = await loadStore();
  const row: TutorListing = {
    id: `tutor-${crypto.randomUUID()}`,
    name: input.name,
    subject: input.subject,
    pricePerHour: Math.max(500, Math.floor(input.pricePerHour)),
    rating: Math.max(1, Math.min(5, Number(input.rating.toFixed(1)))),
    about: input.about,
    city: input.city,
    experienceYears: Math.max(0, Math.floor(input.experienceYears)),
    reviews: [],
    createdAt: new Date().toISOString(),
  };

  store.tutors.push(row);
  await saveStore(store);
  return row;
}
