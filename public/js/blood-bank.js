// Blood Bank page: stock, donor search, emergency request, donor registration

checkLogin('patient');
showNavbar('patient', 'blood-bank.html');

let me = null; // the logged-in patient's details

async function loadStock() {
  const result = await api('/api/blood-stock');
  let html = '';
  for (const row of result.stock) {
    const width = Math.min(row.units * 4, 100); // 25 units = full bar
    const lowClass = row.units < 5 ? 'low' : '';
    html += `
      <div class="stock-row">
        <span class="blood-group">${row.group}</span>
        <div class="stock-bar"><div class="stock-fill ${lowClass}" style="width: ${width}%"></div></div>
        <span>${row.units} units ${row.units < 5 ? '⚠️' : ''}</span>
      </div>`;
  }
  document.getElementById('stock').innerHTML = html;

  // Show which groups this patient can receive
  me = await api('/api/me');
  if (me.bloodGroup) {
    document.getElementById('my-group').innerHTML =
      `Your blood group is <b>${esc(me.bloodGroup)}</b>. You can receive: ${result.canReceiveFrom[me.bloodGroup].join(', ')}`;
    document.getElementById('search-group').value = me.bloodGroup;
  }
  if (me.city) document.getElementById('search-city').value = me.city;
  document.getElementById('r-phone').value = me.phone || '';
  showDonorSection();
}

async function searchDonors() {
  const group = document.getElementById('search-group').value;
  const city = document.getElementById('search-city').value;
  const compatible = document.getElementById('search-compatible').checked ? 'yes' : 'no';
  const donors = await api('/api/donors?group=' + encodeURIComponent(group) + '&city=' + encodeURIComponent(city) + '&compatible=' + compatible);

  if (donors.length === 0) {
    document.getElementById('donor-results').innerHTML = '<p class="muted">No donors found. Try another city or send an emergency request.</p>';
    return;
  }
  let rows = '';
  for (const d of donors) {
    rows += `<tr>
      <td><span class="blood-group">${d.bloodGroup}</span></td>
      <td>${esc(d.name)}<br><span class="muted">${esc(d.city)}</span></td>
      <td>${d.eligible ? '<span class="badge green">Can donate now</span>' : `<span class="badge grey">${esc(d.reason)}</span>`}</td>
      <td><a href="tel:${esc(d.phone)}">${esc(d.phone)}</a></td>
    </tr>`;
  }
  document.getElementById('donor-results').innerHTML = `<br><div class="table-box"><table>${rows}</table></div>`;
}

// ---------- Emergency request ----------
document.getElementById('request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/blood-requests', 'POST', {
      patientName: document.getElementById('r-name').value,
      bloodGroup: document.getElementById('r-group').value,
      units: document.getElementById('r-units').value,
      urgency: document.getElementById('r-urgency').value,
      hospital: document.getElementById('r-hospital').value,
      phone: document.getElementById('r-phone').value,
    });
    showMessage('request-message', 'Request sent. The blood bank team will contact you.');
    document.getElementById('request-form').reset();
    loadMyRequests();
  } catch (error) {
    showMessage('request-message', error.message, 'error');
  }
});

async function loadMyRequests() {
  const requests = await api('/api/blood-requests');
  if (requests.length === 0) {
    document.getElementById('my-requests').innerHTML = '<p class="muted">No requests yet.</p>';
    return;
  }
  let html = '';
  for (const r of requests) {
    html += `<p><span class="blood-group">${r.bloodGroup}</span> ${r.units} unit(s) for ${esc(r.patientName)} – ${statusBadge(r.status)}</p>`;
  }
  document.getElementById('my-requests').innerHTML = html;
}

// ---------- Donor registration ----------
async function showDonorSection() {
  const donor = await api('/api/my-donor');
  const box = document.getElementById('donor-section');

  // Already a donor: show status
  if (donor) {
    box.innerHTML = `
      <p>Thank you for registering as a <span class="blood-group">${donor.bloodGroup}</span> donor!</p>
      <p>Status: ${donor.verified ? '<span class="badge green">Verified</span>' : '<span class="badge orange">Waiting for verification</span>'}</p>
      <p>Last donation: ${donor.lastDonation ? formatDate(donor.lastDonation) : 'Not yet'}</p>
      <p>${donor.eligible ? '✅ You can donate now' : 'ℹ️ ' + esc(donor.reason)}</p>`;
    return;
  }

  // Not a donor yet: show the form
  box.innerHTML = `
    <p class="muted">Rules: age 18–65, weight at least 45 kg, 90 days since your last donation.</p>
    <form id="donor-form">
      <div class="form-row">
        <div>
          <label for="d-group">Blood group</label>
          <select id="d-group" required>
            <option value="">Select</option>
            <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
            <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
          </select>
        </div>
        <div>
          <label for="d-city">City</label>
          <input id="d-city" required value="${esc(me.city || '')}">
        </div>
        <div>
          <label for="d-age">Age</label>
          <input type="number" id="d-age" required value="${getAge(me.dob)}">
        </div>
        <div>
          <label for="d-weight">Weight (kg)</label>
          <input type="number" id="d-weight" required>
        </div>
        <div>
          <label for="d-phone">Phone</label>
          <input id="d-phone" required value="${esc(me.phone || '')}">
        </div>
        <div>
          <label for="d-last">Last donation (if any)</label>
          <input type="date" id="d-last" max="${todayText()}">
        </div>
      </div>
      <div id="donor-message"></div>
      <br>
      <button type="submit" class="btn">Register as donor</button>
    </form>`;
  document.getElementById('d-group').value = me.bloodGroup || '';

  document.getElementById('donor-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/donors', 'POST', {
        bloodGroup: document.getElementById('d-group').value,
        city: document.getElementById('d-city').value,
        age: document.getElementById('d-age').value,
        weight: document.getElementById('d-weight').value,
        phone: document.getElementById('d-phone').value,
        lastDonation: document.getElementById('d-last').value,
      });
      showDonorSection();
    } catch (error) {
      showMessage('donor-message', error.message, 'error');
    }
  });
}

loadStock().then(searchDonors);
loadMyRequests();
