import type { SlidesResponse } from './api';

// Brand palette for the exported decks (dark, executive look consistent with the app).
const BG = '0B1220';        // deep navy
const CARD = '111A2B';      // slightly lighter panel
const ACCENT = '34D399';    // emerald
const TEXT = 'E5E7EB';      // slate-200
const MUTED = '94A3B8';     // slate-400
const WHITE = 'FFFFFF';

function safeFileName(s: string): string {
  return (s || 'slides').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'slides';
}

/**
 * Export the 2-slide deck as a real PowerPoint (.pptx) file.
 * Dynamically imports pptxgenjs so it never bloats the initial bundle.
 */
export async function exportSlidesToPPTX(deck: SlidesResponse, accountName: string): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE';
  pptx.author = 'AWS Training & Certification';
  pptx.company = 'AWS';
  pptx.title = deck.deck_title || `${accountName} — Executive Conversation`;

  deck.slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    // Deck kicker (small, top-left)
    slide.addText((deck.deck_title || accountName).toUpperCase(), {
      x: 0.6, y: 0.35, w: 12.1, h: 0.35, fontSize: 11, color: ACCENT, bold: true, charSpacing: 1,
    });

    // Title
    slide.addText(s.title || '', {
      x: 0.6, y: 0.75, w: 12.1, h: 1.0, fontSize: 30, color: WHITE, bold: true, valign: 'top',
    });

    // Subtitle
    let bulletsTop = 1.9;
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.6, y: 1.75, w: 12.1, h: 0.5, fontSize: 15, color: MUTED, italic: true, valign: 'top',
      });
      bulletsTop = 2.4;
    }

    // Accent divider
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: bulletsTop - 0.15, w: 2.2, h: 0.04, fill: { color: ACCENT } });

    // Bullets
    const bullets = (s.bullets || []).map(b => ({
      text: b,
      options: { bullet: { code: '2022', indent: 18 }, color: TEXT, fontSize: 17, paraSpaceAfter: 12 },
    }));
    if (bullets.length) {
      slide.addText(bullets as any, {
        x: 0.7, y: bulletsTop, w: 12.0, h: s.footer ? 4.0 : 4.6, valign: 'top', lineSpacingMultiple: 1.1,
      });
    }

    // Footer (proof point / CTA) in an accent band
    if (s.footer) {
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 6.35, w: 12.1, h: 0.75, fill: { color: CARD }, line: { color: ACCENT, width: 1 } });
      slide.addText(s.footer, {
        x: 0.8, y: 6.35, w: 11.7, h: 0.75, fontSize: 14, color: ACCENT, bold: true, valign: 'middle',
      });
    }

    // Slide number
    slide.addText(`${idx + 1} / ${deck.slides.length}`, {
      x: 11.8, y: 0.35, w: 0.9, h: 0.35, fontSize: 10, color: MUTED, align: 'right',
    });
  });

  await pptx.writeFile({ fileName: `${safeFileName(accountName)}-exec-slides.pptx` });
}

/**
 * Export the 2-slide deck as a PDF (one landscape page per slide).
 * Dynamically imports jspdf.
 */
export async function exportSlidesToPDF(deck: SlidesResponse, accountName: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40; // margin

  const hex = (h: string): [number, number, number] => [
    parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
  ];

  deck.slides.forEach((s, idx) => {
    if (idx > 0) doc.addPage();

    // Background
    doc.setFillColor(...hex(BG));
    doc.rect(0, 0, W, H, 'F');

    // Kicker
    doc.setTextColor(...hex(ACCENT));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text((deck.deck_title || accountName).toUpperCase(), M, M + 6);

    // Title
    doc.setTextColor(...hex(WHITE));
    doc.setFontSize(26);
    const titleLines = doc.splitTextToSize(s.title || '', W - 2 * M);
    doc.text(titleLines, M, M + 44);
    let y = M + 44 + titleLines.length * 30;

    // Subtitle
    if (s.subtitle) {
      doc.setTextColor(...hex(MUTED));
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(13);
      const subLines = doc.splitTextToSize(s.subtitle, W - 2 * M);
      doc.text(subLines, M, y + 4);
      y += subLines.length * 18 + 6;
    }

    // Accent divider
    doc.setFillColor(...hex(ACCENT));
    doc.rect(M, y, 120, 3, 'F');
    y += 24;

    // Bullets
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    (s.bullets || []).forEach(b => {
      const lines = doc.splitTextToSize(b, W - 2 * M - 18);
      // bullet dot
      doc.setFillColor(...hex(ACCENT));
      doc.circle(M + 4, y - 4, 2.5, 'F');
      doc.setTextColor(...hex(TEXT));
      doc.text(lines, M + 18, y);
      y += lines.length * 18 + 10;
    });

    // Footer band
    if (s.footer) {
      const fh = 46;
      doc.setFillColor(...hex(CARD));
      doc.rect(M, H - M - fh, W - 2 * M, fh, 'F');
      doc.setTextColor(...hex(ACCENT));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const fLines = doc.splitTextToSize(s.footer, W - 2 * M - 24);
      doc.text(fLines, M + 12, H - M - fh + 20);
    }

    // Slide number
    doc.setTextColor(...hex(MUTED));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${idx + 1} / ${deck.slides.length}`, W - M, M + 6, { align: 'right' });
  });

  doc.save(`${safeFileName(accountName)}-exec-slides.pdf`);
}
