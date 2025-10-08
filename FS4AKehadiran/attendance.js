/* attendance.js
   Versi diperbaiki untuk keserasian Mobile (Chrome / Safari)
   Simpan sebagai attendance.js di folder yang sama dengan index.html
*/

const STORAGE_KEY = 'kk_attendance_data_fs4a';
let clubData = {};           // Struktur: { clubName: { students: [], dates: [], lastSaved: ... } }
let currentClub = '';

// ----------------- Utiliti Tarikh -----------------
function getTodayDateDDMMYYYY() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}
function dateToYYYYMMDD(dateStr) {
    // Input: DD-MM-YYYY => Output: YYYY-MM-DD
    const parts = dateStr.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ----------------- Muat / Simpan -----------------
function loadAllData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        clubData = raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error("Gagal membaca localStorage:", e);
        clubData = {};
    }
    populateClubDropdown();
}

function saveAttendance() {
    if (!currentClub || !clubData[currentClub]) {
        alert("Tiada kelab dipilih.");
        return;
    }

    const students = clubData[currentClub].students;
    const dates = clubData[currentClub].dates;
    const tbody = document.getElementById('attendanceTableBody');

    students.forEach((student, rowIndex) => {
        const row = tbody.rows[rowIndex];
        if (!row) return;
        dates.forEach((date, dateIndex) => {
            const cell = row.cells[dateIndex + 4]; // selepas 4 kolum tetap
            if (!cell) return;
            const checkbox = cell.querySelector('input[type="checkbox"]');
            if (checkbox) student.attendance[date] = checkbox.checked;
        });
    });

    clubData[currentClub].lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clubData));
    alert("✅ Kehadiran berjaya disimpan!");
    renderTable(clubData[currentClub].students, clubData[currentClub].dates);
}

function clearStorage() {
    if (confirm("Adakah anda pasti mahu PADAM SEMUA rekod kehadiran yang tersimpan? Tindakan ini tidak boleh diundur.")) {
        localStorage.removeItem(STORAGE_KEY);
        clubData = {};
        currentClub = '';
        document.getElementById('attendance-section').style.display = 'none';
        alert("Semua rekod kehadiran telah dipadam.");
        loadAllData();
    }
}

// ----------------- Import CSV (mesra Mobile) -----------------
function showLoading(on=true) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = on ? 'flex' : 'none';
}

function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files && fileInput.files[0];

    if (!file) {
        alert("Sila pilih fail CSV dahulu.");
        return;
    }

    // Minta nama kelab daripada pengguna
    let clubNamePrompt = prompt("Masukkan NAMA KELAB/PERSATUAN (Contoh: Kelab Bola Sepak):");
    if (!clubNamePrompt || clubNamePrompt.trim() === '') {
        // Reset input supaya pengguna boleh pilih semula pada mobile
        fileInput.value = '';
        return;
    }
    clubNamePrompt = clubNamePrompt.trim();

    const reader = new FileReader();
    showLoading(true);

    reader.onload = function(e) {
        // Ringankan beban UI (biar overlay muncul sebelum pemprosesan)
        setTimeout(() => {
            try {
                const students = parseCSV(String(e.target.result || ''));
                if (!students.length) {
                    alert("Tiada rekod murid ditemui dalam fail CSV.");
                    return;
                }

                currentClub = clubNamePrompt;
                clubData[currentClub] = {
                    students: students,
                    dates: [], // belum ada tarikh
                    lastSaved: new Date().toISOString()
                };

                localStorage.setItem(STORAGE_KEY, JSON.stringify(clubData));
                loadClubData(currentClub);
                alert(`✅ Senarai ahli untuk "${currentClub}" berjaya dimuat naik.`);
            } catch (err) {
                console.error(err);
                alert("Ralat memproses CSV: " + (err.message || err));
            } finally {
                // Reset & sembunyikan loading
                fileInput.value = '';
                showLoading(false);
            }
        }, 200);
    };

    reader.onerror = function(evt) {
        console.error("FileReader error:", evt);
        alert("Gagal membaca fail. Pastikan fail CSV valid dan cuba sekali lagi.");
        showLoading(false);
        fileInput.value = '';
    };

    // Baca sebagai teks (paksa UTF-8 untuk kestabilan)
    try {
        reader.readAsText(file, 'UTF-8');
    } catch (err) {
        // Fallback tanpa encoding (kadang-kadang diperlukan pada peranti tertentu)
        try {
            reader.readAsText(file);
        } catch (e) {
            alert("Gagal membaca fail pada peranti ini. Sila cuba di pelayar lain atau pastikan fail disimpan sebagai UTF-8 CSV.");
            showLoading(false);
            fileInput.value = '';
        }
    }
}

// ----------------- Parser CSV (mudah tetapi efektif) -----------------
function parseCSV(csvText) {
    // Hilangkan BOM jika ada
    const clean = csvText.replace(/^\uFEFF/, '').trim();
    if (!clean) return [];

    // Sokong CRLF & LF
    const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 2) {
        alert("Fail CSV mesti mempunyai baris header dan sekurang-kurangnya satu baris data.");
        return [];
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIndex = headers.indexOf('nama murid');
    const classIndex = headers.indexOf('kelas');
    const genderIndex = headers.indexOf('jantina');

    if (nameIndex === -1 || classIndex === -1 || genderIndex === -1) {
        alert("Ralat: CSV mesti mengandungi lajur: 'Nama Murid', 'Kelas', dan 'Jantina'.");
        return [];
    }

    const students = [];
    for (let i = 1; i < lines.length; i++) {
        // Potongan ringkas; jika data mengandungi koma di dalam petikan, parser ini tidak akan tangani -
        // Untuk kes mudah sekolah, biasanya baris sederhana sudah memadai.
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.every(c => c === '')) continue;

        students.push({
            bil: students.length + 1,
            nama: cols[nameIndex] || 'N/A',
            kelas: cols[classIndex] || 'N/A',
            jantina: cols[genderIndex] || 'N/A',
            attendance: {}
        });
    }
    return students;
}

// ----------------- Kelab: Dropdown & Load -----------------
function populateClubDropdown() {
    const dropdown = document.getElementById('clubName');
    dropdown.innerHTML = '<option value="">-- Pilih Kelab Tersimpan --</option>';
    const names = Object.keys(clubData).sort();
    names.forEach(n => {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        dropdown.appendChild(o);
    });

    if (currentClub && clubData[currentClub]) {
        dropdown.value = currentClub;
        loadClubData(currentClub);
    }
}

function loadClubData(clubOverride) {
    const clubToLoad = clubOverride || document.getElementById('clubName').value;
    if (clubToLoad && clubData[clubToLoad]) {
        currentClub = clubToLoad;
        document.getElementById('currentClubDisplay').textContent = currentClub;
        document.getElementById('attendance-section').style.display = 'block';
        const { students, dates } = clubData[currentClub];
        renderTable(students, dates);
        document.getElementById('clubName').value = currentClub;
    } else {
        document.getElementById('attendance-section').style.display = 'none';
    }
}

// ----------------- Jadual Dinamik -----------------
function addNewDateColumn() {
    if (!currentClub || !clubData[currentClub]) {
        alert("Sila pilih atau muat naik senarai ahli dahulu.");
        return;
    }
    const suggestion = getTodayDateDDMMYYYY();
    let newDate = prompt(`Masukkan tarikh perjumpaan baru (Format: DD-MM-YYYY)\nContoh: ${suggestion}`, suggestion);
    if (!newDate) return;
    newDate = newDate.trim();
    if (!/^\d{2}-\d{2}-\d{4}$/.test(newDate)) {
        alert("Format tarikh tidak sah. Gunakan DD-MM-YYYY.");
        return;
    }

    const club = clubData[currentClub];
    if (club.dates.includes(newDate)) {
        alert("Tarikh ini sudah wujud untuk kelab ini.");
        return;
    }

    // Tambah tarikh & tandakan semua hadir (default)
    club.dates.push(newDate);
    club.dates.sort((a,b) => dateToYYYYMMDD(a).localeCompare(dateToYYYYMMDD(b)));
    club.students.forEach(s => s.attendance[newDate] = true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clubData));
    renderTable(club.students, club.dates);
}

function renderTable(students, dates) {
    const tableBody = document.getElementById('attendanceTableBody');
    const headerRow = document.getElementById('tableHeader');
    tableBody.innerHTML = '';

    // Header dinamik (tarikh)
    headerRow.innerHTML = `
        <th>Bil</th>
        <th>Nama Murid</th>
        <th>Kelas</th>
        <th>Jantina</th>
        ${dates.map(d => `<th>${d}</th>`).join('')}
        <th>Jumlah Hadir</th>
    `;

    students.forEach((s, idx) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = idx + 1;
        row.insertCell().textContent = s.nama;
        row.insertCell().textContent = s.kelas;
        row.insertCell().textContent = s.jantina;

        let total = 0;
        dates.forEach(d => {
            const cell = row.insertCell();
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!s.attendance[d];
            cb.addEventListener('change', (e) => {
                s.attendance[d] = e.target.checked;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(clubData));
                // Kemas kini jumlah tanpa render semula penuh untuk lebih laju:
                // (tetapi untuk kesederhanaan kita render semula)
                renderTable(students, dates);
            });
            cell.appendChild(cb);
            if (s.attendance[d]) total++;
        });

        row.insertCell().textContent = total;
    });

    generateSummary(students, dates);
}

// ----------------- Rumusan -----------------
function generateSummary(students, dates) {
    const summaryBody = document.getElementById('summaryTableBody');
    summaryBody.innerHTML = '';

    dates.forEach(d => {
        let male = 0, female = 0;
        students.forEach(s => {
            if (s.attendance[d]) {
                const g = (s.jantina || '').toString().toUpperCase().trim();
                if (g.startsWith('L')) male++;
                else if (g.startsWith('P')) female++;
            }
        });
        const tr = summaryBody.insertRow();
        tr.insertCell().textContent = d;
        tr.insertCell().textContent = male;
        tr.insertCell().textContent = female;
        tr.insertCell().textContent = male + female;
    });
}

// ----------------- Eksport CSV -----------------
function exportToCSV() {
    if (!currentClub || !clubData[currentClub] || !clubData[currentClub].students.length) {
        alert("Tiada data kehadiran untuk dieksport.");
        return;
    }
    const { students, dates } = clubData[currentClub];
    const fixed = ["Bil", "Nama Murid", "Kelas", "Jantina"];
    const headers = [...fixed, ...dates, "Jumlah Hadir"];
    let csv = headers.join(",") + "\n";

    students.forEach((s, i) => {
        let total = 0;
        const base = [i+1, `"${String(s.nama).replace(/"/g,'""')}"`, `"${String(s.kelas).replace(/"/g,'""')}"`, `"${String(s.jantina).replace(/"/g,'""')}"`];
        dates.forEach(d => {
            const present = s.attendance[d] ? '1' : '0';
            if (present === '1') total++;
            base.push(present);
        });
        base.push(total);
        csv += base.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentClub}_Kehadiran_${getTodayDateDDMMYYYY()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ----------------- Inisialisasi -----------------
/* Apabila skrip dimuat, loadAllData() akan dipanggil oleh onload di index.html */
