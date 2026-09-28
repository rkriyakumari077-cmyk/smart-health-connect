// Downloadable PDFs (prescriptions and lab reports) made in the browser with jsPDF.
// jsPDF's built-in fonts only cover basic Latin, so a few symbols are replaced.
(function () {
  const TEAL = [2, 128, 144];
  const INK = [3, 24, 27];
  const MUTED = [91, 122, 126];
  const LINE = [216, 235, 233];
  const RED = [196, 60, 25];
  const GREEN = [1, 122, 94];

  const clean = (s) =>
    String(s ?? '')
      .replace(/[–—]/g, '-')
      .replace(/₹/g, 'Rs. ')
      .replace(/[×]/g, 'x')
      .replace(/[µμ]/g, 'u')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[^\x00-\xff]/g, '');

  function doc() {
    if (!window.jspdf) throw new Error('PDF library did not load. Refresh the page and try again.');
    return new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  }

  function header(pdf, title, ref, date) {
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setFillColor(2, 195, 154);
    pdf.circle(20, 15, 6, 'F');
    pdf.setDrawColor(...INK);
    pdf.setLineWidth(1.4);
    pdf.line(20, 11.5, 20, 18.5);
    pdf.line(16.5, 15, 23.5, 15);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('Smart Health Connect', 31, 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(159, 192, 192);
    pdf.text(clean(title), 31, 20);
    pdf.setTextColor(255, 255, 255);
    pdf.text(clean(ref), 195, 14, { align: 'right' });
    pdf.setTextColor(159, 192, 192);
    pdf.text(clean(date), 195, 20, { align: 'right' });
    return 42;
  }

  function label(pdf, text, x, y) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(clean(text), x, y);
  }
  function value(pdf, text, x, y, { size = 10.5, bold = true, color = INK, maxWidth } = {}) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = maxWidth ? pdf.splitTextToSize(clean(text), maxWidth) : [clean(text)];
    pdf.text(lines, x, y);
    return lines.length * size * 0.42;
  }

  // Grid of label/value pairs, 3 per row.
  function infoGrid(pdf, y, pairs) {
    const colW = 60;
    pairs.forEach(([l, v], i) => {
      const x = 15 + (i % 3) * colW;
      const yy = y + Math.floor(i / 3) * 13;
      label(pdf, l, x, yy);
      value(pdf, v || '-', x, yy + 5, { maxWidth: colW - 4 });
    });
    const rows = Math.ceil(pairs.length / 3);
    const end = y + rows * 13 + 2;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(15, end, 195, end);
    return end + 8;
  }

  function section(pdf, y, title) {
    y = pageBreak(pdf, y, 20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    pdf.setTextColor(...TEAL);
    pdf.text(clean(title), 15, y);
    return y + 6;
  }

  function pageBreak(pdf, y, need) {
    if (y + need > 275) {
      pdf.addPage();
      return 20;
    }
    return y;
  }

  // Simple table: cols = [{ title, w, get(row), color?(row) }]
  function table(pdf, y, cols, rows) {
    const x0 = 15;
    const drawHead = (yy) => {
      pdf.setFillColor(242, 248, 247);
      pdf.rect(x0, yy - 5, 180, 8, 'F');
      let x = x0 + 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      for (const c of cols) {
        pdf.text(clean(c.title), x, yy);
        x += c.w;
      }
      return yy + 8;
    };
    y = drawHead(y);
    for (const r of rows) {
      pdf.setFontSize(9.5);
      const cells = cols.map((c) => pdf.splitTextToSize(clean(c.get(r)), c.w - 3));
      const h = Math.max(...cells.map((l) => l.length)) * 4.3 + 3;
      if (y + h > 275) {
        pdf.addPage();
        y = drawHead(20);
      }
      let x = x0 + 2;
      cols.forEach((c, i) => {
        const color = c.color ? c.color(r) : INK;
        pdf.setFont('helvetica', c.bold || (c.boldIf && c.boldIf(r)) ? 'bold' : 'normal');
        pdf.setTextColor(...color);
        pdf.text(cells[i], x, y);
        x += c.w;
      });
      pdf.setDrawColor(...LINE);
      pdf.line(x0, y + h - 4, x0 + 180, y + h - 4);
      y += h;
    }
    return y + 4;
  }

  function paragraph(pdf, y, text) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(clean(text), 180);
    for (const line of lines) {
      y = pageBreak(pdf, y, 6);
      pdf.text(line, 15, y);
      y += 5;
    }
    return y + 3;
  }

  function footer(pdf, note) {
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(...LINE);
      pdf.line(15, 283, 195, 283);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...MUTED);
      pdf.text(pdf.splitTextToSize(clean(note), 150), 15, 288);
      pdf.text(`Page ${i} of ${pages}`, 195, 288, { align: 'right' });
    }
  }

  const who = (gender, dob) => UI.genderAge(gender, dob) || '-';
  const fileName = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

  function prescription(p) {
    const pdf = doc();
    let y = header(pdf, 'Digital prescription', `Rx #${p.appointment_id || p.id}`, UI.fmtDate(p.appt_date, { year: true }));
    y = infoGrid(pdf, y, [
      ['Patient', p.patient_name],
      ['Gender / age', who(p.patient_gender, p.patient_dob)],
      ['Visit', `${UI.fmtDate(p.appt_date, { year: true })}, ${UI.time12(p.slot_time)}`],
      ['Doctor', p.doctor_name],
      ['Speciality', p.specialization || p.department],
      ['Department', p.department],
    ]);
    y = section(pdf, y, 'Diagnosis');
    y = paragraph(pdf, y, p.diagnosis);
    y = section(pdf, y, 'Medicines');
    const meds = p.medicines || [];
    if (meds.length) {
      y = table(
        pdf,
        y,
        [
          { title: '#', w: 8, get: (r) => String(meds.indexOf(r) + 1) },
          { title: 'Medicine', w: 64, get: (r) => r.name, bold: true },
          { title: 'Dosage', w: 30, get: (r) => r.dosage || '-' },
          { title: 'How often', w: 44, get: (r) => r.frequency || '-' },
          { title: 'For', w: 34, get: (r) => r.duration || '-' },
        ],
        meds
      );
    } else y = paragraph(pdf, y, 'No medicines prescribed.');
    if (p.advice) {
      y = section(pdf, y, 'Advice');
      y = paragraph(pdf, y, p.advice);
    }
    if (p.follow_up_date) {
      y = section(pdf, y, 'Follow-up');
      y = paragraph(pdf, y, UI.fmtDate(p.follow_up_date, { year: true }));
    }
    y = pageBreak(pdf, y + 8, 20);
    pdf.setDrawColor(...INK);
    pdf.line(135, y + 6, 195, y + 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text(clean(p.doctor_name), 195, y + 11, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text('Digitally issued prescription', 195, y + 15.5, { align: 'right' });
    footer(pdf, 'Generated by Smart Health Connect. Take medicines only as prescribed. Contact your doctor if symptoms get worse. In an emergency call 112.');
    pdf.save(`prescription-${fileName(p.patient_name)}-${p.appt_date}.pdf`);
  }

  function report(r) {
    const pdf = doc();
    let y = header(pdf, 'Laboratory report', `Report #${r.booking_id || r.id}`, UI.fmtDate((r.created_at || '').slice(0, 10), { year: true }));
    y = infoGrid(pdf, y, [
      ['Patient', r.patient_name],
      ['Gender / age', who(r.patient_gender, r.patient_dob)],
      ['Test', r.test_name],
      ['Sample date', UI.fmtDate(r.booking_date, { year: true })],
      ['Collection', r.collection_type === 'home' ? 'Home collection' : 'Lab visit'],
      ['Reported', UI.fmtDate((r.created_at || '').slice(0, 10), { year: true })],
    ]);
    y = section(pdf, y, 'Results');
    const bad = (row) => row.flag && row.flag !== 'normal';
    y = table(
      pdf,
      y,
      [
        { title: 'Parameter', w: 62, get: (x) => x.name },
        { title: 'Result', w: 28, get: (x) => String(x.value), color: (x) => (bad(x) ? RED : INK), bold: true },
        { title: 'Unit', w: 26, get: (x) => x.unit || '-' },
        { title: 'Reference range', w: 40, get: (x) => rangeText(x) },
        { title: 'Flag', w: 24, get: (x) => (x.flag || '').toUpperCase(), color: (x) => (bad(x) ? RED : GREEN), bold: true },
      ],
      r.results || []
    );
    y = section(pdf, y + 2, 'Summary');
    y = paragraph(pdf, y, r.summary || '');
    if (r.technician_name) {
      label(pdf, `Reported by ${r.technician_name}`, 15, pageBreak(pdf, y + 4, 10));
    }
    footer(pdf, 'Generated by Smart Health Connect. Reference ranges are for adults and can differ between labs. Discuss your results with a doctor before making any treatment decision.');
    pdf.save(`report-${fileName(r.test_name)}-${fileName(r.patient_name)}.pdf`);
  }

  function rangeText(p) {
    if (p.ref_text) return p.ref_text;
    if (p.low !== null && p.low !== undefined && p.high !== null && p.high !== undefined) return `${p.low} - ${p.high}`;
    if (p.low !== null && p.low !== undefined) return `>= ${p.low}`;
    if (p.high !== null && p.high !== undefined) return `< ${p.high}`;
    return '-';
  }

  window.PDF = { prescription, report, rangeText };
})();
