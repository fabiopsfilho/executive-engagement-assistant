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
 * Export the conversational deck as a real PowerPoint (.pptx) file.
 * Each content slide leads with the big insight, shows the sparse bullets, a
 * suggested-visual placeholder, and the talking point. Dense detail is placed on
 * a final Appendix slide. Dynamically imports pptxgenjs so it never bloats the bundle.
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
      x: 0.6, y: 0.75, w: 12.1, h: 0.9, fontSize: 30, color: WHITE, bold: true, valign: 'top',
    });

    // Subtitle
    let y = 1.7;
    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.6, y, w: 12.1, h: 0.45, fontSize: 15, color: MUTED, italic: true, valign: 'top',
      });
      y += 0.5;
    }

    // Accent divider
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 2.2, h: 0.04, fill: { color: ACCENT } });
    y += 0.25;

    // The single big insight (the headline idea for the slide)
    if (s.insight) {
      slide.addText(s.insight, {
        x: 0.6, y, w: 7.4, h: 1.0, fontSize: 19, color: WHITE, bold: true, valign: 'top', lineSpacingMultiple: 1.05,
      });
      y += 1.1;
    }

    // Sparse bullets (left column)
    const bullets = (s.bullets || []).map(b => ({
      text: b,
      options: { bullet: { code: '2022', indent: 18 }, color: TEXT, fontSize: 16, paraSpaceAfter: 10 },
    }));
    if (bullets.length) {
      slide.addText(bullets as any, {
        x: 0.7, y, w: 7.3, h: 2.4, valign: 'top', lineSpacingMultiple: 1.1,
      });
    }

    // Right column: suggested visual placeholder (a card describing the graphic to draw)
    if (s.visual) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 8.4, y: 2.1, w: 4.3, h: 2.6, fill: { color: CARD }, line: { color: ACCENT, width: 1, dashType: 'dash' },
      });
      slide.addText('SUGGESTED VISUAL', {
        x: 8.6, y: 2.25, w: 3.9, h: 0.3, fontSize: 10, color: ACCENT, bold: true, charSpacing: 1,
      });
      slide.addText(s.visual, {
        x: 8.6, y: 2.6, w: 3.9, h: 2.0, fontSize: 13, color: TEXT, valign: 'top', lineSpacingMultiple: 1.1,
      });
    }

    // Talking point band (drives the conversation)
    if (s.talking_point) {
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 5.35, w: 12.1, h: 0.85, fill: { color: '0E1A14' }, line: { color: ACCENT, width: 1 } });
      slide.addText([
        { text: 'ASK THEM:  ', options: { color: ACCENT, bold: true, fontSize: 13 } },
        { text: s.talking_point, options: { color: TEXT, italic: true, fontSize: 13 } },
      ] as any, {
        x: 0.8, y: 5.35, w: 11.7, h: 0.85, valign: 'middle', lineSpacingMultiple: 1.05,
      });
    }

    // Footer (proof point / CTA)
    if (s.footer) {
      slide.addText(s.footer, {
        x: 0.6, y: 6.4, w: 11.0, h: 0.6, fontSize: 13, color: ACCENT, bold: true, valign: 'middle',
      });
    }

    // Slide number
    slide.addText(`${idx + 1} / ${deck.slides.length}`, {
      x: 11.8, y: 0.35, w: 0.9, h: 0.35, fontSize: 10, color: MUTED, align: 'right',
    });
  });

  // Appendix slide — the dense "read more" detail kept off the main slides.
  if (deck.appendix && deck.appendix.length > 0) {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    slide.addText('APPENDIX', {
      x: 0.6, y: 0.35, w: 12.1, h: 0.35, fontSize: 11, color: ACCENT, bold: true, charSpacing: 1,
    });
    slide.addText('Read more — supporting detail & proof points', {
      x: 0.6, y: 0.75, w: 12.1, h: 0.7, fontSize: 24, color: WHITE, bold: true, valign: 'top',
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.55, w: 2.2, h: 0.04, fill: { color: ACCENT } });

    const items: any[] = [];
    deck.appendix.forEach(a => {
      items.push({ text: a.heading, options: { color: ACCENT, bold: true, fontSize: 14, paraSpaceBefore: 8, paraSpaceAfter: 2 } });
      items.push({ text: a.detail, options: { color: TEXT, fontSize: 12.5, paraSpaceAfter: 6 } });
    });
    slide.addText(items as any, {
      x: 0.7, y: 1.85, w: 12.0, h: 5.2, valign: 'top', lineSpacingMultiple: 1.05,
    });
  }

  await pptx.writeFile({ fileName: `${safeFileName(accountName)}-exec-slides.pptx` });
}

/**
 * Export the conversational deck as a PDF (one landscape page per slide, plus an
 * appendix page). Dynamically imports jspdf.
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
    doc.setFontSize(24);
    const titleLines = doc.splitTextToSize(s.title || '', W - 2 * M);
    doc.text(titleLines, M, M + 40);
    let y = M + 40 + titleLines.length * 26;

    // Subtitle
    if (s.subtitle) {
      doc.setTextColor(...hex(MUTED));
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(12);
      const subLines = doc.splitTextToSize(s.subtitle, W - 2 * M);
      doc.text(subLines, M, y + 2);
      y += subLines.length * 16 + 4;
    }

    // Accent divider
    doc.setFillColor(...hex(ACCENT));
    doc.rect(M, y, 120, 3, 'F');
    y += 22;

    // Big insight
    if (s.insight) {
      doc.setTextColor(...hex(WHITE));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      const insLines = doc.splitTextToSize(s.insight, W - 2 * M - 220);
      doc.text(insLines, M, y);
      y += insLines.length * 20 + 8;
    }

    // Bullets (left column)
    const colW = W - 2 * M - 220; // leave room for the visual card on the right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    (s.bullets || []).forEach(b => {
      const lines = doc.splitTextToSize(b, colW - 18);
      doc.setFillColor(...hex(ACCENT));
      doc.circle(M + 4, y - 4, 2.5, 'F');
      doc.setTextColor(...hex(TEXT));
      doc.text(lines, M + 18, y);
      y += lines.length * 16 + 8;
    });

    // Suggested visual card (right column)
    if (s.visual) {
      const cardX = W - M - 200;
      const cardY = M + 90;
      const cardW = 200;
      const cardH = 150;
      doc.setFillColor(...hex(CARD));
      doc.setDrawColor(...hex(ACCENT));
      doc.setLineDashPattern([3, 2], 0);
      doc.rect(cardX, cardY, cardW, cardH, 'FD');
      doc.setLineDashPattern([], 0);
      doc.setTextColor(...hex(ACCENT));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('SUGGESTED VISUAL', cardX + 10, cardY + 16);
      doc.setTextColor(...hex(TEXT));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const vLines = doc.splitTextToSize(s.visual, cardW - 20);
      doc.text(vLines, cardX + 10, cardY + 34);
    }

    // Talking point band
    if (s.talking_point) {
      const bh = 44;
      const by = H - M - bh - (s.footer ? 26 : 0);
      doc.setFillColor(14, 26, 20);
      doc.setDrawColor(...hex(ACCENT));
      doc.setLineWidth(1);
      doc.rect(M, by, W - 2 * M, bh, 'FD');
      doc.setTextColor(...hex(ACCENT));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('ASK THEM:', M + 12, by + 18);
      doc.setTextColor(...hex(TEXT));
      doc.setFont('helvetica', 'italic');
      const tLines = doc.splitTextToSize(s.talking_point, W - 2 * M - 90);
      doc.text(tLines, M + 78, by + 18);
    }

    // Footer
    if (s.footer) {
      doc.setTextColor(...hex(ACCENT));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const fLines = doc.splitTextToSize(s.footer, W - 2 * M);
      doc.text(fLines, M, H - M - 4);
    }

    // Slide number
    doc.setTextColor(...hex(MUTED));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${idx + 1} / ${deck.slides.length}`, W - M, M + 6, { align: 'right' });
  });

  // Appendix page
  if (deck.appendix && deck.appendix.length > 0) {
    doc.addPage();
    doc.setFillColor(...hex(BG));
    doc.rect(0, 0, W, H, 'F');
    doc.setTextColor(...hex(ACCENT));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('APPENDIX', M, M + 6);
    doc.setTextColor(...hex(WHITE));
    doc.setFontSize(22);
    doc.text('Read more — supporting detail & proof points', M, M + 40);
    doc.setFillColor(...hex(ACCENT));
    doc.rect(M, M + 52, 120, 3, 'F');

    let y = M + 78;
    doc.setLineWidth(1);
    deck.appendix.forEach(a => {
      if (y > H - M - 40) { doc.addPage(); doc.setFillColor(...hex(BG)); doc.rect(0, 0, W, H, 'F'); y = M + 20; }
      doc.setTextColor(...hex(ACCENT));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      const hLines = doc.splitTextToSize(a.heading, W - 2 * M);
      doc.text(hLines, M, y);
      y += hLines.length * 16 + 2;
      doc.setTextColor(...hex(TEXT));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const dLines = doc.splitTextToSize(a.detail, W - 2 * M);
      doc.text(dLines, M, y);
      y += dLines.length * 15 + 12;
    });
  }

  doc.save(`${safeFileName(accountName)}-exec-slides.pdf`);
}
