// Health Records page: every prescription and lab report of the patient

checkLogin('patient');
showNavbar('patient', 'health-records.html');

let withPrescription = [];
let withReport = [];

async function loadRecords() {
  // Prescriptions come with the appointments
  const appointments = await api('/api/appointments');
  withPrescription = appointments.filter((a) => a.prescription).reverse();

  let rows = '';
  withPrescription.forEach((a, index) => {
    rows += `<tr>
      <td>${formatDate(a.date)}</td>
      <td>${esc(a.doctorName)}<br><span class="muted">${esc(a.specialization)}</span></td>
      <td><b>${esc(a.prescription.diagnosis)}</b><br><span class="muted">${a.prescription.medicines.map(esc).join('<br>')}</span></td>
      <td><button class="btn btn-small" onclick="downloadPrescription(withPrescription[${index}])">Download PDF</button></td>
    </tr>`;
  });
  document.getElementById('prescriptions').innerHTML = withPrescription.length === 0
    ? '<p class="muted">No prescriptions yet.</p>'
    : `<div class="table-box"><table><tr><th>Date</th><th>Doctor</th><th>Diagnosis and medicines</th><th></th></tr>${rows}</table></div>`;

  // Reports come with the test bookings
  const bookings = await api('/api/test-bookings');
  withReport = bookings.filter((b) => b.report);

  rows = '';
  withReport.forEach((b, index) => {
    const outOfRange = b.report.results.filter((r) => r.flag !== 'Normal');
    rows += `<tr>
      <td>${formatDate(b.report.date)}</td>
      <td><b>${esc(b.test.name)}</b></td>
      <td>${outOfRange.length === 0 ? statusBadge('Normal') : outOfRange.map((r) => esc(r.name) + ' ' + statusBadge(r.flag)).join('<br>')}
        <br><span class="muted">${esc(b.report.remarks)}</span></td>
      <td><button class="btn btn-small" onclick="downloadReport(withReport[${index}])">Download PDF</button></td>
    </tr>`;
  });
  document.getElementById('reports').innerHTML = withReport.length === 0
    ? '<p class="muted">No lab reports yet.</p>'
    : `<div class="table-box"><table><tr><th>Date</th><th>Test</th><th>Result</th><th></th></tr>${rows}</table></div>`;
}

loadRecords();
