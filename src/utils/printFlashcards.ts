import type { LearningItem } from "../api/learning-items";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printFlashcards(cards: LearningItem[], title: string = "Flashcards"): void {
  const popup = window.open("", "_blank", "width=1024,height=768");
  if (!popup) return;

  const cardsHtml = cards
    .map((card) => {
      const question = escapeHtml(card.question || "");
      const answer = escapeHtml(card.answer || "");
      return `
        <article class="card">
          <section class="face front">
            <h3>Q</h3>
            <p>${question}</p>
          </section>
          <section class="face back">
            <h3>A</h3>
            <p>${answer}</p>
          </section>
        </article>
      `;
    })
    .join("\n");

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Georgia, serif; margin: 24px; color: #222; }
          h1 { margin: 0 0 16px 0; font-size: 20px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .card { border: 1px solid #444; border-radius: 8px; overflow: hidden; break-inside: avoid; }
          .face { padding: 10px; min-height: 120px; }
          .front { border-bottom: 1px dashed #999; background: #f8f8f8; }
          .face h3 { margin: 0 0 6px 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
          .face p { margin: 0; font-size: 14px; line-height: 1.35; white-space: pre-wrap; }
          @media print {
            body { margin: 10mm; }
            .grid { gap: 8mm; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="grid">${cardsHtml}</div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

