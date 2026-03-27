import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function buildSimplePdf(lines) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const contentLines = ["BT", "/F1 12 Tf", "1 0 0 1 50 770 Tm"];
  for (let i = 0; i < lines.length; i += 1) {
    const line = esc(lines[i]);
    if (i === 0) {
      contentLines.push(`(${line}) Tj`);
    } else {
      contentLines.push("0 -18 Td");
      contentLines.push(`(${line}) Tj`);
    }
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

async function main() {
  const now = Date.now();
  const courseId = `custom-test-course-${now}`;
  const sectionId = `custom-test-section-${now}`;
  const lessonId = `custom-test-lesson-${now}`;
  const taskId = `custom-test-task-${now}`;

  const course = await prisma.customCourse.create({
    data: {
      id: courseId,
      title: "[TEST] Курс: квадратные уравнения",
      description: "Тестовый курс для проверки урока, чата и OCR теории.",
      subject: "math",
    },
  });

  const section = await prisma.customSection.create({
    data: {
      id: sectionId,
      courseId: course.id,
      title: "[TEST] Раздел: базовые формулы",
    },
  });

  const lesson = await prisma.customLesson.create({
    data: {
      id: lessonId,
      sectionId: section.id,
      title: "[TEST] Урок: решение квадратных уравнений",
      description: "Проверочный урок для приоритетного ответа AI по файлу теории.",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
  });

  const task = await prisma.customTask.create({
    data: {
      id: taskId,
      lessonId: lesson.id,
      type: "numeric",
      question: "Решите уравнение x^2 - 5x + 6 = 0. Введите меньший корень.",
      options: null,
      answer: "2",
      solution:
        "Разложим на множители: (x-2)(x-3)=0, значит корни x=2 и x=3. Меньший корень: 2.",
    },
  });

  const theoryLines = [
    "Theory for lesson task:",
    "1) For x^2 - 5x + 6 = 0 use factorization.",
    "2) (x-2)(x-3)=0 so roots are 2 and 3.",
    "3) If asked for the smaller root, answer 2.",
  ];

  const pdfBytes = buildSimplePdf(theoryLines);
  const knowledgeDir = path.join(process.cwd(), "data", "lesson-knowledge");
  await fs.mkdir(knowledgeDir, { recursive: true });
  const pdfPath = path.join(knowledgeDir, `${lesson.id}-theory.pdf`);
  await fs.writeFile(pdfPath, pdfBytes);

  const extractedText = theoryLines.join("\n");

  await prisma.lessonKnowledge.upsert({
    where: { lessonId: lesson.id },
    update: {
      originalName: "test-theory.pdf",
      mimeType: "application/pdf",
      storagePath: pdfPath,
      extractedText,
      summary: "Формула и корни уравнения x^2 - 5x + 6 = 0; меньший корень равен 2.",
      pageCount: 1,
      textChars: extractedText.length,
    },
    create: {
      lessonId: lesson.id,
      originalName: "test-theory.pdf",
      mimeType: "application/pdf",
      storagePath: pdfPath,
      extractedText,
      summary: "Формула и корни уравнения x^2 - 5x + 6 = 0; меньший корень равен 2.",
      pageCount: 1,
      textChars: extractedText.length,
    },
  });

  console.log(JSON.stringify({ courseId, sectionId, lessonId, taskId, pdfPath }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
