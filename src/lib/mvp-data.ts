export type Subject = "math" | "physics";

export type Task = {
  id: string;
  type: "numeric" | "choice";
  question: string;
  options?: string[];
  answer: string;
  solution: string;
};

export type Lesson = {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
  tasks: Task[];
};

export type Section = {
  id: string;
  courseId: string;
  title: string;
  lessonIds: string[];
};

export type Course = {
  id: string;
  subject: Subject;
  title: string;
  description: string;
  sectionIds: string[];
  progress: number;
};

export const courses: Course[] = [
  {
    id: "math-base",
    subject: "math",
    title: "ЕГЭ Математика: Профиль",
    description: "База + задачи повышенной сложности.",
    sectionIds: ["math-algebra", "math-geometry"],
    progress: 35,
  },
  {
    id: "physics-base",
    subject: "physics",
    title: "ЕГЭ Физика: Полный курс",
    description: "Механика, электродинамика и практика задач.",
    sectionIds: ["phys-mech"],
    progress: 10,
  },
];

export const sections: Section[] = [
  {
    id: "math-algebra",
    courseId: "math-base",
    title: "Алгебра",
    lessonIds: ["lesson-math-1", "lesson-math-2"],
  },
  {
    id: "math-geometry",
    courseId: "math-base",
    title: "Геометрия",
    lessonIds: ["lesson-math-3"],
  },
  {
    id: "phys-mech",
    courseId: "physics-base",
    title: "Механика",
    lessonIds: ["lesson-phys-1"],
  },
];

export const lessons: Lesson[] = [
  {
    id: "lesson-math-1",
    sectionId: "math-algebra",
    title: "Квадратные уравнения",
    description: "Формулы, дискриминант и типовые задачи ЕГЭ.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    tasks: [
      {
        id: "task-1",
        type: "numeric",
        question: "Решите x^2 - 5x + 6 = 0. Введите меньший корень.",
        answer: "2",
        solution:
          "x^2 - 5x + 6 = 0 => (x-2)(x-3)=0. Корни: 2 и 3. Меньший корень: 2.",
      },
      {
        id: "task-2",
        type: "choice",
        question: "Чему равен дискриминант уравнения x^2 - 2x - 3 = 0?",
        options: ["16", "8", "4", "0"],
        answer: "16",
        solution: "D = b^2 - 4ac = (-2)^2 - 4*1*(-3) = 4 + 12 = 16.",
      },
    ],
  },
  {
    id: "lesson-math-2",
    sectionId: "math-algebra",
    title: "Логарифмы",
    description: "Свойства логарифмов и базовые преобразования.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    tasks: [],
  },
  {
    id: "lesson-math-3",
    sectionId: "math-geometry",
    title: "Площади фигур",
    description: "Формулы площадей и практические задания.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    tasks: [],
  },
  {
    id: "lesson-phys-1",
    sectionId: "phys-mech",
    title: "Законы Ньютона",
    description: "Три закона Ньютона и задачи на силу.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    tasks: [],
  },
];

export function getCourseById(courseId: string) {
  return courses.find((course) => course.id === courseId);
}

export function getSectionById(sectionId: string) {
  return sections.find((section) => section.id === sectionId);
}

export function getLessonById(lessonId: string) {
  return lessons.find((lesson) => lesson.id === lessonId);
}

export function getSectionsByCourseId(courseId: string) {
  return sections.filter((section) => section.courseId === courseId);
}

