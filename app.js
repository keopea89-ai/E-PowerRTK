/**
 * E-PowerRTK: Electricity Billing & Management Frontend Application
 */

// State
let currentTab = 'dashboard';
let customersCache = [];
let invoiceStatusFilter = 'all';
let editingCustomerId = null;
let customerSearchTimer = null;
let readingSearchTimer = null;
let invoiceSearchTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initHeaderDate();
    loadDashboardStats();
    loadDashboardTables();
    loadCustomers();
    loadReadings();
    loadInvoices();
    loadPaymentsTable();
    loadReceiptsTable();
    loadVoidPaymentsTable();
    initE03TabForm();

    // Auto-refresh stats every 30 seconds
    setInterval(loadDashboardStats, 30000);

    // Close E01 search dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.e01-tab-search-box');
        const dropdown = document.getElementById('e01SearchDropdown');
        if (dropdown && wrap && !wrap.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
});

// Format Helpers
function formatKHR(num) {
    return Number(num || 0).toLocaleString('en-US') + ' ៛';
}

function formatUSD(num, rate = 4000) {
    return '$' + (Number(num || 0) / rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(num) {
    return Number(num || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function initHeaderDate() {
    const now = new Date();
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = now.toLocaleDateString('km-KH', options);
    const elem = document.getElementById('headerDateDisplay');
    if (elem) elem.textContent = dateStr || now.toISOString().split('T')[0];
}

// ----------------- Tab Navigation -----------------
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update sidebar menu items
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update tab content panes
    document.querySelectorAll('.tab-content').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // Dynamic Header Text
    const titleElem = document.getElementById('pageHeadingTitle');
    const subElem = document.getElementById('pageHeadingSub');
    if (titleElem && subElem) {
        if (tabName === 'dashboard') {
            titleElem.textContent = 'ផ្ទាំងគ្រប់គ្រង (Dashboard)';
            subElem.textContent = 'ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យការប្រើប្រាស់ភ្លើង និងចេញវិក្កយបត្រ';
        } else if (tabName === 'customers') {
            titleElem.textContent = 'គ្រប់គ្រងអតិថិជន (Customers - E01)';
            subElem.textContent = 'បញ្ជីទិន្នន័យអតិថិជន ទីតាំង និងលេខនាឡិកាស្ទង់/កុងទ័រ (Meter ID)';
        } else if (tabName === 'readings') {
            titleElem.textContent = 'បញ្ចូលការប្រើប្រាស់ (Meter Readings - E02)';
            subElem.textContent = 'កត់ត្រាលេខកុងទ័រចាស់-ថ្មី និងគណនាថាមពលប្រើប្រាស់ (kWh)';
        } else if (tabName === 'payments') {
            titleElem.textContent = 'បង់ប្រាក់ & ប្រតិបត្តិការ (Payments - E03)';
            subElem.textContent = 'គ្រប់គ្រងការបង់ប្រាក់ថ្លៃភ្លើង សាច់ប្រាក់ KHQR និងធនាគារ';
        } else if (tabName === 'receipts') {
            titleElem.textContent = 'បោះពុម្ពបង្កាន់ដៃ (Print Receipts - E04)';
            subElem.textContent = 'ស្វែងរក និងបោះពុម្ពបង្កាន់ដៃផ្លូវការរបស់ អាជីវកម្ម អគ្គិសនី រតនគិរី';
        } else if (tabName === 'void_payments') {
            titleElem.textContent = 'លុបការបង់ប្រាក់ (Void Payments - E05)';
            subElem.textContent = 'និរាករណ៍ប្រតិបត្តិការបង់ប្រាក់ និងផ្លាស់ប្តូរវិក្កយបត្រមកជា "មិនទាន់បង់" វិញ';
        } else if (tabName === 'invoices') {
            titleElem.textContent = 'វិក្កយបត្រ & ការទូទាត់ (Invoices & Payments)';
            subElem.textContent = 'គ្រប់គ្រងវិក្កយបត្រ ស្ថានភាពទូទាត់ និងបោះពុម្ពវិក្កយបត្រ KHQR';
        }
    }

    // Refresh tab-specific data
    if (tabName === 'dashboard') {
        loadDashboardStats();
        loadDashboardTables();
    } else if (tabName === 'customers') {
        loadCustomers();
    } else if (tabName === 'readings') {
        loadReadings();
    } else if (tabName === 'payments') {
        initE03TabForm();
        loadPaymentsTable();
    } else if (tabName === 'receipts') {
        loadReceiptsTable();
    } else if (tabName === 'void_payments') {
        loadVoidPaymentsTable();
    } else if (tabName === 'invoices') {
        loadInvoices(invoiceStatusFilter);
    }
}

// ----------------- Toast Notifications -----------------
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3500);
}

// ----------------- Dashboard -----------------
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        const json = await res.json();
        if (json.success) {
            const s = json.data;
            document.getElementById('statCustomers').textContent = s.total_customers;
            document.getElementById('statUnits').textContent = formatNumber(s.total_units_this_month);
            document.getElementById('statRevenue').textContent = formatKHR(s.total_revenue);
            document.getElementById('statRevenueUsd').textContent = formatUSD(s.total_revenue);
            document.getElementById('statUnpaidCount').textContent = `${s.unpaid_count} វិក្កយបត្រ`;
            document.getElementById('statUnpaidAmount').textContent = formatKHR(s.unpaid_amount);
        }
    } catch (err) {
        console.error('Error fetching stats:', err);
    }
}

async function loadDashboardTables() {
    // Load recent invoices
    try {
        const res = await fetch('/api/invoices');
        const json = await res.json();
        const tbody = document.getElementById('dashboardInvoicesTable');
        if (json.success && json.data.length > 0) {
            const recent = json.data.slice(0, 5);
            tbody.innerHTML = recent.map(inv => `
                <tr>
                    <td><strong><a href="/invoice/${inv.invoice_id}" target="_blank">${inv.invoice_id}</a></strong></td>
                    <td>${inv.customer_name}</td>
                    <td>${inv.month_year}</td>
                    <td><strong>${formatNumber(inv.total_units)}</strong> kWh</td>
                    <td><strong style="color:#0284c7">${formatKHR(inv.total_amount)}</strong></td>
                    <td>
                        <span class="badge ${inv.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}" 
                              onclick="toggleInvoiceStatus('${inv.invoice_id}', true)" title="ចុចដើម្បីប្តូរស្ថានភាព">
                            ${inv.status === 'Paid' ? '✓ បង់រួច' : '⏳ មិនទាន់បង់'}
                        </span>
                    </td>
                    <td>
                        <a href="/invoice/${inv.invoice_id}" target="_blank" class="btn btn-sm btn-outline">
                            🖨️ បោះពុម្ព
                        </a>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">មិនទាន់មានទិន្នន័យនៅឡើយទេ</td></tr>';
        }
    } catch (err) {
        console.error('Error loading dashboard invoices:', err);
    }

    // Load recent readings
    try {
        const res = await fetch('/api/readings');
        const json = await res.json();
        const tbody = document.getElementById('dashboardReadingsTable');
        if (json.success && json.data.length > 0) {
            const recent = json.data.slice(0, 5);
            tbody.innerHTML = recent.map(r => `
                <tr>
                    <td><strong>${r.reading_id}</strong></td>
                    <td>${r.customer_name} <br><small class="text-muted">${r.meter_number}</small></td>
                    <td>${formatNumber(r.old_reading)} &rarr; ${formatNumber(r.new_reading)}</td>
                    <td><span style="color:#0284c7; font-weight:700;">${formatNumber(r.total_units)} kWh</span></td>
                    <td>${r.recorded_date}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">មិនទាន់មានទិន្នន័យនៅឡើយទេ</td></tr>';
        }
    } catch (err) {
        console.error('Error loading dashboard readings:', err);
    }
}

// ----------------- Customers Management -----------------
function doCustomerSearch() {
    const input = document.getElementById('customerSearchInput');
    const val = input ? input.value.trim() : '';
    clearTimeout(customerSearchTimer);
    loadCustomers(val);
}

function handleCustomerInputSearch() {
    const input = document.getElementById('customerSearchInput');
    const clearBtn = document.getElementById('btnCustomerSearchClear');
    const val = input ? input.value : '';
    if (clearBtn) clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(() => {
        loadCustomers(val.trim());
    }, 250);
}

function handleCustomerSearchKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(customerSearchTimer);
        doCustomerSearch();
    } else if (event.key === 'Escape') {
        clearCustomerSearch();
    }
}

function clearCustomerSearch() {
    const input = document.getElementById('customerSearchInput');
    const clearBtn = document.getElementById('btnCustomerSearchClear');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    clearTimeout(customerSearchTimer);
    loadCustomers('');
}

async function loadCustomers(search = null) {
    if (search === null || typeof search !== 'string') {
        const input = document.getElementById('customerSearchInput');
        search = input ? input.value.trim() : '';
    }
    const clearBtn = document.getElementById('btnCustomerSearchClear');
    if (clearBtn) {
        clearBtn.style.display = search.length > 0 ? 'inline-flex' : 'none';
    }

    try {
        const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : '/api/customers';
        const res = await fetch(url);
        const json = await res.json();
        const tbody = document.getElementById('customersTableBody');

        if (json.success && json.data.length > 0) {
            customersCache = json.data;
            tbody.innerHTML = json.data.map(c => {
                const displayName = `${c.honorific ? c.honorific + ' ' : ''}${c.name || ''}`;
                const latinName = (c.last_name_en || c.first_name_en) ? `${c.last_name_en || ''} ${c.first_name_en || ''}`.trim() : '';
                return `
                <tr>
                    <td><strong style="color:#0284c7">${c.customer_id}</strong></td>
                    <td>
                        <strong style="font-size:0.95rem;">${displayName}</strong>
                        ${latinName ? `<div style="font-size:0.75rem; color:#94a3b8;">${latinName}</div>` : ''}
                    </td>
                    <td><span style="font-size:0.85rem;">${c.gender || 'ប្រុស'}</span></td>
                    <td><span style="font-size:0.85rem;">${c.job || '-'}</span></td>
                    <td>
                        <div><strong>${c.phone || '-'}</strong></div>
                        ${c.account_no ? `<div style="font-size:0.75rem; color:#38bdf8;">A/C: ${c.account_no}</div>` : ''}
                    </td>
                    <td><span style="font-family:var(--font-num); font-size:0.85rem; font-weight:600;">${c.national_id || '-'}</span></td>
                    <td>
                        <span class="badge ${c.is_poor ? 'badge-unpaid' : 'badge-paid'}" style="font-size:0.75rem;">
                            ${c.customer_type || 'បុគ្គលមិនជាប់អាករ'}${c.is_poor ? ' (ក្រីក្រ)' : ''}
                        </span>
                    </td>
                    <td><div style="max-width:210px; font-size:0.8rem; line-height:1.35;">${c.address || '-'}</div></td>
                    <td><span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">${c.meter_number}</span></td>
                    <td><span style="font-size:0.82rem;">${c.registered_date}</span></td>
                    <td>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="btn btn-sm btn-accent" onclick="openReadingModalForCustomer('${c.customer_id}')" title="កត់ត្រាកុងទ័រភ្លើង">
                                ⚡
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="viewCustomerDetail('${c.customer_id}')" title="មើលព័ត៌មានលម្អិត">
                                👁️
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="editCustomer('${c.customer_id}')" title="កែប្រែព័ត៌មានអតិថិជន" style="color:#0284c7; border-color:#38bdf8;">
                                ✏️
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="deleteCustomer('${c.customer_id}', '${(c.name || '').replace(/'/g, "\\'")}')" title="លុបអតិថិជន" style="color:#ef4444; border-color:#f87171;">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center" style="padding: 36px 20px;">
                        <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
                        <div style="color: #94a3b8; font-size: 0.95rem;">
                            ${search ? `រកមិនឃើញអតិថិជនណាដែលត្រូវនឹង "<strong>${search}</strong>" ឡើយ!` : 'មិនទាន់មានទិន្នន័យអតិថិជននៅឡើយទេ'}
                        </div>
                        ${search ? `<button class="btn btn-sm btn-outline" style="margin-top:12px;" onclick="clearCustomerSearch()">បង្ហាញអតិថិជនទាំងអស់ឡើងវិញ</button>` : ''}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loading customers:', err);
    }
}

function viewCustomerDetail(customerId) {
    const c = customersCache.find(item => item.customer_id === customerId);
    if (!c) return;

    document.getElementById('detailCustomerTitle').textContent = `ព័ត៌មានលម្អិតអតិថិជន - ${c.customer_id} (${c.name})`;
    document.getElementById('btnDetailRecordReading').onclick = function() {
        closeModal('modalCustomerDetail');
        openReadingModalForCustomer(c.customer_id);
    };
    const btnEdit = document.getElementById('btnDetailEdit');
    if (btnEdit) {
        btnEdit.onclick = function() {
            closeModal('modalCustomerDetail');
            editCustomer(c.customer_id);
        };
    }
    const btnDelete = document.getElementById('btnDetailDelete');
    if (btnDelete) {
        btnDelete.onclick = function() {
            deleteCustomer(c.customer_id, c.name);
        };
    }

    const container = document.getElementById('customerDetailContent');
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 130px; gap: 16px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
            <div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                    ${c.honorific ? c.honorific + ' ' : ''}${c.name}
                    ${(c.last_name_en || c.first_name_en) ? `<span style="font-size:0.88rem; color:#64748b; font-weight:600;">(${c.last_name_en || ''} ${c.first_name_en || ''})</span>` : ''}
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.85rem; color: #334155;">
                    <div><strong>លេខកូដ៖</strong> <span style="color:#0284c7; font-weight:700;">${c.customer_id}</span></div>
                    <div><strong>ភេទ៖</strong> ${c.gender || 'ប្រុស'}</div>
                    <div><strong>ថ្ងៃកំណើត៖</strong> ${c.dob || '-'}</div>
                    <div><strong>ទីកន្លែងកំណើត៖</strong> ${c.pob || '-'}</div>
                    <div><strong>មុខរបរ៖</strong> ${c.job || '-'}</div>
                    <div><strong>ចំនួនគ្រួសារ៖</strong> ${c.family_count || 1} នាក់</div>
                    <div><strong>ប្រភេទអត្តសញ្ញាណ៖</strong> ${c.id_type || 'អត្តសញ្ញាណប័ណ្ណ'}</div>
                    <div><strong>លេខអត្តសញ្ញាណ៖</strong> ${c.national_id || '-'}</div>
                    <div><strong>អ្នកតំណាង៖</strong> ${c.representative || '-'}</div>
                    <div><strong>ប្រភេទអតិថិជន៖</strong> <span class="badge ${c.is_poor ? 'badge-unpaid' : 'badge-paid'}" style="font-size:0.75rem;">${c.customer_type || 'បុគ្គលមិនជាប់អាករ'}${c.is_poor ? ' (ក្រីក្រ)' : ''}</span></div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center;">
                <div style="width: 115px; height: 135px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
                    ${c.photo ? `<img src="${c.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:42px; opacity:0.35;">👤</span>`}
                </div>
                <span style="font-size:0.75rem; color:#64748b; margin-top:4px;">រូបថតអតិថិជន</span>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.85rem; color: #334155;">
            <div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">📞 ព័ត៌មានទំនាក់ទំនង</div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div><strong>ទូរស័ព្ទ៖</strong> <span style="font-weight:700; color:#0284c7;">${c.phone || '-'}</span></div>
                    <div><strong>លេខគណនី៖</strong> ${c.account_no || '-'}</div>
                    <div><strong>ខេត្ត/ក្រុង៖</strong> ${c.province || 'រតនគិរី'} - <strong>ស្រុក/ខណ្ឌ៖</strong> ${c.district || 'បានលុង'}</div>
                    <div><strong>ឃុំ/សង្កាត់៖</strong> ${c.commune || 'កាចាញ'} - <strong>ភូមិ៖</strong> ${c.village || 'ភូមិ ២'}</div>
                    <div><strong>ផ្ទះលេខ៖</strong> ${c.house_no || '-'} - <strong>ផ្លូវលេខ៖</strong> ${c.street_no || '-'}</div>
                    <div><strong>អាសយដ្ឋានពេញ៖</strong> ${c.address || '-'}</div>
                </div>
            </div>
            <div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">⚡ ព័ត៌មានកុងទ័រភ្លើង</div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div><strong>លេខកុងទ័រ (Meter ID)៖</strong> <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">${c.meter_number}</span></div>
                    <div><strong>នាឡិកាស្ទង់៖</strong> ${c.meter_type || '1-Phase (ធម្មតា 220V)'}</div>
                    <div><strong>ថ្ងៃចុះឈ្មោះ៖</strong> ${c.registered_date}</div>
                    <div><strong>តម្លៃក្នុង ១ kWh៖</strong> 800 ៛</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalCustomerDetail').classList.add('active');
}

function doCustomerSearch() {
    const input = document.getElementById('customerSearchInput');
    const val = input ? input.value.trim() : '';
    clearTimeout(customerSearchTimer);
    loadCustomers(val);
}

function handleCustomerInputSearch() {
    const input = document.getElementById('customerSearchInput');
    const clearBtn = document.getElementById('btnCustomerSearchClear');
    const val = input ? input.value : '';
    if (clearBtn) {
        clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
    }
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(() => {
        loadCustomers(val.trim());
    }, 250);
}

function handleCustomerSearchKeyDown(event) {
    if (event.key === 'Enter') {
        clearTimeout(customerSearchTimer);
        doCustomerSearch();
    } else if (event.key === 'Escape') {
        clearCustomerSearch();
    }
}

function clearCustomerSearch() {
    const input = document.getElementById('customerSearchInput');
    const clearBtn = document.getElementById('btnCustomerSearchClear');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    clearTimeout(customerSearchTimer);
    loadCustomers('');
}

// ----------------- E01 Customer Dialog Helpers -----------------
function switchCustomerTab(tab) {
    const btnGen = document.getElementById('e01TabGeneralBtn');
    const btnUse = document.getElementById('e01TabUsageBtn');
    const pnlGen = document.getElementById('e01TabGeneral');
    const pnlUse = document.getElementById('e01TabUsage');

    if (!btnGen || !btnUse || !pnlGen || !pnlUse) return;

    if (tab === 'general') {
        btnGen.classList.add('active');
        btnUse.classList.remove('active');
        pnlGen.style.display = 'block';
        pnlUse.style.display = 'none';
    } else {
        btnGen.classList.remove('active');
        btnUse.classList.add('active');
        pnlGen.style.display = 'none';
        pnlUse.style.display = 'block';
    }
}

function syncFullName() {
    const last = document.getElementById('custLastName') ? document.getElementById('custLastName').value.trim() : '';
    const first = document.getElementById('custFirstName') ? document.getElementById('custFirstName').value.trim() : '';
    const full = `${last} ${first}`.trim();
    const hiddenName = document.getElementById('custName');
    if (hiddenName) {
        hiddenName.value = full || last || first;
    }
}

function updateFullAddress() {
    const prov = document.getElementById('custProvince') ? document.getElementById('custProvince').value : 'រតនគិរី';
    const dist = document.getElementById('custDistrict') ? document.getElementById('custDistrict').value : 'បានលុង';
    const comm = document.getElementById('custCommune') ? document.getElementById('custCommune').value : 'កាចាញ';
    const vill = document.getElementById('custVillage') ? document.getElementById('custVillage').value : 'ភូមិ ២';
    const house = document.getElementById('custHouseNo') ? document.getElementById('custHouseNo').value.trim() : '';
    const street = document.getElementById('custStreetNo') ? document.getElementById('custStreetNo').value.trim() : '';
    
    let parts = [];
    if (house) parts.push(`ផ្ទះលេខ ${house}`);
    if (street) parts.push(`ផ្លូវលេខ ${street}`);
    parts.push(vill, `សង្កាត់ ${comm}`, `ក្រុង ${dist}`, `ខេត្ត${prov}`);
    
    const addrField = document.getElementById('custAddress');
    if (addrField) {
        addrField.value = parts.join(' ');
    }
}

function previewCustPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('custPhotoPreview');
        const ph = document.getElementById('custPhotoPlaceholder');
        if (preview && ph) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            ph.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

// ----------------- E01 Modal Customer Search & Usage History -----------------
let e01SearchTimer = null;

function handleE01SearchInput() {
    const input = document.getElementById('e01CustomerSearchInput');
    const clearBtn = document.getElementById('btnE01SearchClear');
    const query = input ? input.value : '';
    if (clearBtn) clearBtn.style.display = query.trim().length > 0 ? 'inline-block' : 'none';

    clearTimeout(e01SearchTimer);
    e01SearchTimer = setTimeout(() => {
        performE01CustomerSearch(query.trim());
    }, 200);
}

function handleE01SearchKeyDown(event) {
    if (event.key === 'Escape') {
        const dropdown = document.getElementById('e01SearchDropdown');
        if (dropdown) dropdown.style.display = 'none';
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const firstItem = document.querySelector('.e01-dropdown-item');
        if (firstItem) firstItem.click();
    }
}

function clearE01Search() {
    const input = document.getElementById('e01CustomerSearchInput');
    const clearBtn = document.getElementById('btnE01SearchClear');
    const dropdown = document.getElementById('e01SearchDropdown');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    if (dropdown) dropdown.style.display = 'none';
}

function focusE01Search() {
    const input = document.getElementById('e01CustomerSearchInput');
    if (input) {
        input.focus();
        input.select();
        performE01CustomerSearch(input.value.trim());
    }
}

async function performE01CustomerSearch(query) {
    const dropdown = document.getElementById('e01SearchDropdown');
    if (!dropdown) return;

    try {
        const url = query ? `/api/customers?search=${encodeURIComponent(query)}` : '/api/customers';
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data.length > 0) {
            const list = json.data.slice(0, 8);
            dropdown.innerHTML = list.map(c => `
                <div class="e01-dropdown-item" onclick="selectCustomerInE01('${c.customer_id}')">
                    <div class="e01-item-top">
                        <strong class="e01-item-id">${c.customer_id}</strong>
                        <span class="e01-item-name">${c.honorific ? c.honorific + ' ' : ''}${c.name}</span>
                        <span class="e01-item-meter">${c.meter_number || '-'}</span>
                    </div>
                    <div class="e01-item-sub">
                        <span>📞 ${c.phone || '-'}</span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">📍 ${c.village || ''} ${c.commune || ''} ${c.district || ''}</span>
                    </div>
                </div>
            `).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = `
                <div style="padding:12px; text-align:center; color:#64748b; font-size:11.5px;">
                    <div>🔍 រកមិនឃើញអតិថិជនត្រូវនឹង "<strong>${query}</strong>" ឡើយ</div>
                    <button type="button" class="btn btn-sm btn-outline" style="margin-top:6px; font-size:10.5px; padding:2px 8px;" onclick="resetCustomerFormToNew()">+ ចុះឈ្មោះជាអតិថិជនថ្មី</button>
                </div>
            `;
            dropdown.style.display = 'block';
        }
    } catch (e) {
        console.error('E01 search error:', e);
    }
}

async function selectCustomerInE01(customerId) {
    const dropdown = document.getElementById('e01SearchDropdown');
    if (dropdown) dropdown.style.display = 'none';

    await editCustomer(customerId);

    const c = customersCache.find(item => item.customer_id === customerId);
    const input = document.getElementById('e01CustomerSearchInput');
    const clearBtn = document.getElementById('btnE01SearchClear');
    if (input && c) {
        input.value = `${c.customer_id} - ${c.name}`;
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';

    loadE01CustomerUsageHistory(customerId);
    showToast(`បានទាញយកទិន្នន័យ: ${c ? c.name : customerId}`, 'success');
}

function resetCustomerFormToNew() {
    const dropdown = document.getElementById('e01SearchDropdown');
    if (dropdown) dropdown.style.display = 'none';
    const input = document.getElementById('e01CustomerSearchInput');
    const clearBtn = document.getElementById('btnE01SearchClear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    openCustomerModal();
    showToast('បានត្រៀមទម្រង់សម្រាប់ចុះឈ្មោះអតិថិជនថ្មី', 'success');
}

async function loadE01CustomerUsageHistory(customerId) {
    const tbody = document.getElementById('e01UsageHistoryBody');
    const badge = document.getElementById('e01UsageCountBadge');
    if (!tbody) return;

    try {
        const res = await fetch(`/api/readings?search=${encodeURIComponent(customerId)}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            if (badge) badge.textContent = `(${json.data.length} កំណត់ត្រា)`;
            tbody.innerHTML = json.data.map(r => `
                <tr>
                    <td><strong style="color:#0284c7;">${r.reading_id}</strong></td>
                    <td>${r.month_year}</td>
                    <td>${formatNumber(r.old_reading)}</td>
                    <td>${formatNumber(r.new_reading)}</td>
                    <td><strong>${formatNumber(r.total_units)}</strong></td>
                    <td><span style="color:#0284c7; font-weight:700;">${formatKHR(r.total_amount || (r.total_units * 800))}</span></td>
                    <td>
                        <span class="badge ${r.invoice_status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}" style="font-size:10px; padding:2px 6px;">
                            ${r.invoice_status === 'Paid' ? 'បង់រួច' : (r.invoice_id ? 'មិនទាន់បង់' : 'គ្មានវិក្កយបត្រ')}
                        </span>
                    </td>
                </tr>
            `).join('');
        } else {
            if (badge) badge.textContent = '(0 កំណត់ត្រា)';
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:#94a3b8; padding:14px;">អតិថិជននេះមិនទាន់មានទិន្នន័យកត់ត្រាកុងទ័រនៅឡើយទេ</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:#ef4444; padding:14px;">មានបញ្ហាក្នុងការទាញយកប្រវត្តិការប្រើប្រាស់</td></tr>';
    }
}

async function openCustomerModal() {
    editingCustomerId = null;
    const titleElem = document.getElementById('modalCustomerTitle');
    if (titleElem) titleElem.textContent = 'បន្ថែមអតិថិជន';
    const btnSave = document.getElementById('btnSaveCustomer');
    if (btnSave) btnSave.textContent = 'រក្សាទុក';

    switchCustomerTab('general');

    const e01SearchInp = document.getElementById('e01CustomerSearchInput');
    const e01ClearBtn = document.getElementById('btnE01SearchClear');
    const e01Drop = document.getElementById('e01SearchDropdown');
    if (e01SearchInp) e01SearchInp.value = '';
    if (e01ClearBtn) e01ClearBtn.style.display = 'none';
    if (e01Drop) e01Drop.style.display = 'none';
    const histBody = document.getElementById('e01UsageHistoryBody');
    if (histBody) histBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:#94a3b8; padding:14px;">ជ្រើសរើសអតិថិជន ឬបញ្ចូលទិន្នន័យដើម្បីមើលប្រវត្តិ</td></tr>';
    const histBadge = document.getElementById('e01UsageCountBadge');
    if (histBadge) histBadge.textContent = '(0 កំណត់ត្រា)';
    try {
        const res = await fetch('/api/next-ids');
        const json = await res.json();
        if (json.success) {
            const nextId = json.data.next_customer_id;
            document.getElementById('custID').value = nextId;
            // Also suggest next meter number
            const num = nextId.replace(/\D/g, '') || '1006';
            document.getElementById('custMeter').value = `MTR-${1000 + parseInt(num)}`;
        }
    } catch (e) {}

    if (document.getElementById('custHonorific')) document.getElementById('custHonorific').value = 'លោក';
    if (document.getElementById('custLastName')) document.getElementById('custLastName').value = '';
    if (document.getElementById('custFirstName')) document.getElementById('custFirstName').value = '';
    if (document.getElementById('custLastNameEn')) document.getElementById('custLastNameEn').value = '';
    if (document.getElementById('custFirstNameEn')) document.getElementById('custFirstNameEn').value = '';
    if (document.getElementById('custGender')) document.getElementById('custGender').value = 'ប្រុស';
    if (document.getElementById('custDob')) document.getElementById('custDob').value = '1990-01-01';
    if (document.getElementById('custPob')) document.getElementById('custPob').value = '';
    if (document.getElementById('custIdType')) document.getElementById('custIdType').value = 'អត្តសញ្ញាណប័ណ្ណ';
    if (document.getElementById('custNationalId')) document.getElementById('custNationalId').value = '';
    if (document.getElementById('custRepresentative')) document.getElementById('custRepresentative').value = '';
    if (document.getElementById('custJob')) document.getElementById('custJob').value = '';
    if (document.getElementById('custFamilyCount')) document.getElementById('custFamilyCount').value = '1';
    if (document.getElementById('custType')) document.getElementById('custType').value = 'បុគ្គលមិនជាប់អាករ';
    if (document.getElementById('custIsPoor')) document.getElementById('custIsPoor').checked = false;
    if (document.getElementById('custName')) document.getElementById('custName').value = '';
    if (document.getElementById('custPhone')) document.getElementById('custPhone').value = '';
    if (document.getElementById('custAccountNo')) document.getElementById('custAccountNo').value = '';
    if (document.getElementById('custProvince')) document.getElementById('custProvince').value = 'រតនគិរី';
    if (document.getElementById('custDistrict')) document.getElementById('custDistrict').value = 'បានលុង';
    if (document.getElementById('custCommune')) document.getElementById('custCommune').value = 'កាចាញ';
    if (document.getElementById('custVillage')) document.getElementById('custVillage').value = 'ភូមិ ២';
    if (document.getElementById('custZone')) document.getElementById('custZone').value = 'បានលុង';
    if (document.getElementById('custHouseNo')) document.getElementById('custHouseNo').value = '';
    if (document.getElementById('custStreetNo')) document.getElementById('custStreetNo').value = '';
    if (document.getElementById('custAddress')) document.getElementById('custAddress').value = 'ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី';
    if (document.getElementById('custMeterType')) document.getElementById('custMeterType').value = '1-Phase (ធម្មតា 220V)';
    if (document.getElementById('custDate')) document.getElementById('custDate').value = new Date().toISOString().split('T')[0];
    
    // Reset photo
    const preview = document.getElementById('custPhotoPreview');
    const ph = document.getElementById('custPhotoPlaceholder');
    if (preview && ph) {
        preview.src = '';
        preview.style.display = 'none';
        ph.style.display = 'flex';
    }

    document.getElementById('modalCustomer').classList.add('active');
}

async function editCustomer(customerId) {
    closeModal('modalCustomerDetail');
    let c = customersCache.find(item => item.customer_id === customerId);
    if (!c) {
        try {
            const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`);
            const json = await res.json();
            if (json.success) c = json.data;
        } catch (e) {}
    }
    if (!c) {
        showToast('រកមិនឃើញទិន្នន័យអតិថិជននេះទេ!', 'error');
        return;
    }

    editingCustomerId = customerId;

    const titleElem = document.getElementById('modalCustomerTitle');
    if (titleElem) titleElem.textContent = `កែប្រែព័ត៌មានអតិថិជន - ${c.customer_id}`;
    const btnSave = document.getElementById('btnSaveCustomer');
    if (btnSave) btnSave.textContent = 'រក្សាទុកការកែប្រែ';

    switchCustomerTab('general');

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    setVal('custID', c.customer_id);
    setVal('custHonorific', c.honorific || 'លោក');
    setVal('custLastName', c.last_name || '');
    setVal('custFirstName', c.first_name || '');
    setVal('custLastNameEn', c.last_name_en || '');
    setVal('custFirstNameEn', c.first_name_en || '');
    setVal('custName', c.name || '');
    setVal('custGender', c.gender || 'ប្រុស');
    setVal('custDob', c.dob || '');
    setVal('custPob', c.pob || '');
    setVal('custIdType', c.id_type || 'អត្តសញ្ញាណប័ណ្ណ');
    setVal('custNationalId', c.national_id || '');
    setVal('custRepresentative', c.representative || '');
    setVal('custJob', c.job || '');
    setVal('custFamilyCount', c.family_count || 1);
    setVal('custType', c.customer_type || 'បុគ្គលមិនជាប់អាករ');
    if (document.getElementById('custIsPoor')) {
        document.getElementById('custIsPoor').checked = !!c.is_poor;
    }

    setVal('custPhone', c.phone || '');
    setVal('custAccountNo', c.account_no || '');
    setVal('custProvince', c.province || 'រតនគិរី');
    setVal('custDistrict', c.district || 'បានលុង');
    setVal('custCommune', c.commune || 'កាចាញ');
    setVal('custVillage', c.village || 'ភូមិ ២');
    setVal('custZone', c.zone || 'បានលុង');
    setVal('custHouseNo', c.house_no || '');
    setVal('custStreetNo', c.street_no || '');
    setVal('custAddress', c.address || '');

    setVal('custMeter', c.meter_number || '');
    setVal('custMeterType', c.meter_type || '1-Phase (ធម្មតា 220V)');
    setVal('custDate', c.registered_date || '');

    // Photo preview
    const preview = document.getElementById('custPhotoPreview');
    const ph = document.getElementById('custPhotoPlaceholder');
    if (c.photo && preview && ph) {
        preview.src = c.photo;
        preview.style.display = 'block';
        ph.style.display = 'none';
    } else if (preview && ph) {
        preview.src = '';
        preview.style.display = 'none';
        ph.style.display = 'flex';
    }

    // Load usage history into Tab 2
    loadE01CustomerUsageHistory(customerId);

    // Sync E01 search input
    const e01SearchInp = document.getElementById('e01CustomerSearchInput');
    const e01ClearBtn = document.getElementById('btnE01SearchClear');
    if (e01SearchInp) e01SearchInp.value = `${c.customer_id} - ${c.name}`;
    if (e01ClearBtn) e01ClearBtn.style.display = 'inline-block';

    document.getElementById('modalCustomer').classList.add('active');
}

async function deleteCustomer(customerId, name) {
    const confirmMsg = `តើអ្នកពិតជាចង់លុបអតិថិជន "${name}" (${customerId}) មែនទេ?\n\nការលុបនេះនឹងលុបទាំងទិន្នន័យកត់ត្រាកុងទ័រ និងវិក្កយបត្រពាក់ព័ន្ធទាំងអស់!`;
    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
            method: 'DELETE'
        });
        const json = await res.json();

        if (json.success) {
            showToast(json.message || 'បានលុបអតិថិជនជោគជ័យ!', 'success');
            closeModal('modalCustomerDetail');
            loadCustomers();
            loadDashboardStats();
            loadDashboardTables();
            loadReadings();
            loadInvoices();
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការលុបអតិថិជន!', 'error');
        }
    } catch (err) {
        showToast('Connection error: ' + err, 'error');
    }
}

async function handleSaveCustomer(event) {
    event.preventDefault();
    syncFullName();

    let name = document.getElementById('custName') ? document.getElementById('custName').value.trim() : '';
    if (!name) {
        showToast('សូមបញ្ចូលគោត្តនាម ឬនាមអតិថិជន!', 'error');
        switchCustomerTab('general');
        if (document.getElementById('custLastName')) document.getElementById('custLastName').focus();
        return;
    }

    const custId = document.getElementById('custID').value.trim();
    let meter = document.getElementById('custMeter') ? document.getElementById('custMeter').value.trim() : '';
    if (!meter) {
        const num = custId.replace(/\D/g, '') || String(Date.now() % 10000);
        meter = `MTR-${1000 + parseInt(num)}`;
        if (document.getElementById('custMeter')) document.getElementById('custMeter').value = meter;
    }

    const isEdit = !!editingCustomerId;
    const btn = document.getElementById('btnSaveCustomer');
    btn.disabled = true;
    btn.textContent = isEdit ? 'កំពុងកែប្រែ...' : 'កំពុងរក្សាទុក...';

    const getVal = (id, def = '') => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : def;
    };

    const photoImg = document.getElementById('custPhotoPreview');
    const photoSrc = (photoImg && photoImg.style.display !== 'none') ? photoImg.src : '';

    const payload = {
        customer_id: custId,
        name: name,
        honorific: getVal('custHonorific', 'លោក'),
        last_name: getVal('custLastName'),
        first_name: getVal('custFirstName'),
        last_name_en: getVal('custLastNameEn'),
        first_name_en: getVal('custFirstNameEn'),
        gender: getVal('custGender', 'ប្រុស'),
        dob: getVal('custDob'),
        pob: getVal('custPob'),
        id_type: getVal('custIdType', 'អត្តសញ្ញាណប័ណ្ណ'),
        national_id: getVal('custNationalId'),
        representative: getVal('custRepresentative'),
        job: getVal('custJob'),
        family_count: parseInt(getVal('custFamilyCount', '1')) || 1,
        customer_type: getVal('custType', 'បុគ្គលមិនជាប់អាករ'),
        is_poor: document.getElementById('custIsPoor')?.checked ? 1 : 0,
        phone: getVal('custPhone'),
        account_no: getVal('custAccountNo'),
        province: getVal('custProvince', 'រតនគិរី'),
        district: getVal('custDistrict', 'បានលុង'),
        commune: getVal('custCommune', 'កាចាញ'),
        village: getVal('custVillage', 'ភូមិ ២'),
        zone: getVal('custZone', 'បានលុង'),
        house_no: getVal('custHouseNo'),
        street_no: getVal('custStreetNo'),
        address: getVal('custAddress', 'ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី'),
        meter_number: meter,
        meter_type: getVal('custMeterType', '1-Phase (ធម្មតា 220V)'),
        photo: photoSrc,
        registered_date: getVal('custDate') || new Date().toISOString().split('T')[0]
    };

    const endpoint = isEdit ? `/api/customers/${encodeURIComponent(editingCustomerId)}` : '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            showToast(json.message, 'success');
            editingCustomerId = null;
            closeModal('modalCustomer');
            loadCustomers();
            loadDashboardStats();
            loadReadings();
            loadInvoices();
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការរក្សាទុក', 'error');
        }
    } catch (err) {
        showToast('Connection error: ' + err, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = isEdit ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុក';
    }
}

// ----------------- Meter Readings Management -----------------
function doReadingSearch() {
    const input = document.getElementById('readingSearchInput');
    const val = input ? input.value.trim() : '';
    clearTimeout(readingSearchTimer);
    loadReadings(val);
}

function handleReadingInputSearch() {
    const input = document.getElementById('readingSearchInput');
    const clearBtn = document.getElementById('btnReadingSearchClear');
    const val = input ? input.value : '';
    if (clearBtn) clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
    clearTimeout(readingSearchTimer);
    readingSearchTimer = setTimeout(() => {
        loadReadings(val.trim());
    }, 250);
}

function handleReadingSearchKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(readingSearchTimer);
        doReadingSearch();
    } else if (event.key === 'Escape') {
        clearReadingSearch();
    }
}

function clearReadingSearch() {
    const input = document.getElementById('readingSearchInput');
    const clearBtn = document.getElementById('btnReadingSearchClear');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    clearTimeout(readingSearchTimer);
    loadReadings('');
}

async function loadReadings(search = null) {
    if (search === null || typeof search !== 'string') {
        const input = document.getElementById('readingSearchInput');
        search = input ? input.value.trim() : '';
    }
    const clearBtn = document.getElementById('btnReadingSearchClear');
    if (clearBtn) clearBtn.style.display = search.length > 0 ? 'inline-flex' : 'none';

    try {
        const url = search ? `/api/readings?search=${encodeURIComponent(search)}` : '/api/readings';
        const res = await fetch(url);
        const json = await res.json();
        const tbody = document.getElementById('readingsTableBody');

        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(r => `
                <tr>
                    <td><strong>${r.reading_id}</strong></td>
                    <td>${r.customer_name}</td>
                    <td><span style="color:#0369a1; font-weight:600;">${r.meter_number}</span></td>
                    <td>${r.month_year}</td>
                    <td>${formatNumber(r.old_reading)}</td>
                    <td>${formatNumber(r.new_reading)}</td>
                    <td><strong style="color:#0284c7; font-size:1rem;">${formatNumber(r.total_units)} kWh</strong></td>
                    <td>${r.recorded_date}</td>
                    <td>
                        ${r.invoice_id 
                            ? `<a href="/invoice/${r.invoice_id}" target="_blank" class="btn btn-sm btn-outline">🧾 ${r.invoice_id}</a>`
                            : `<button class="btn btn-sm btn-primary" onclick="quickCreateInvoice('${r.reading_id}')">+ ចេញវិក្កយបត្រ</button>`
                        }
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding:36px 20px;">
                        <div style="font-size:2.2rem; margin-bottom:8px;">🔍</div>
                        <div style="color:#94a3b8; font-size:0.95rem;">
                            ${search ? `រកមិនឃើញការកត់ត្រាណាដែលត្រូវនឹង "<strong>${search}</strong>" ឡើយ!` : 'មិនទាន់មានទិន្នន័យកត់ត្រាកុងទ័រឡើយ'}
                        </div>
                        ${search ? `<button class="btn btn-sm btn-outline" style="margin-top:12px;" onclick="clearReadingSearch()">បង្ហាញការកត់ត្រាទាំងអស់</button>` : ''}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loading readings:', err);
    }
}

async function openReadingModal(preselectedCustId = null) {
    // Populate next IDs
    try {
        const res = await fetch('/api/next-ids');
        const json = await res.json();
        if (json.success) {
            document.getElementById('readID').value = json.data.next_reading_id;
        }
    } catch (e) {}

    // Month & Dates
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    document.getElementById('readMonthYear').value = `${mm}/${yyyy}`;
    
    // Due date (25th of current month)
    const dueDateStr = `${yyyy}-${mm}-25`;
    document.getElementById('dueDate').value = dueDateStr;

    // Reset values
    document.getElementById('readOld').value = '';
    document.getElementById('readNew').value = '';
    document.getElementById('liveTotalUnits').textContent = '0.00';
    document.getElementById('liveTotalAmount').textContent = '0';
    document.getElementById('liveUsdAmount').textContent = '$0.00';
    document.getElementById('custPreviewBox').style.display = 'none';

    // Populate Customer Dropdown
    const select = document.getElementById('readCustomer');
    select.innerHTML = '<option value="">-- សូមជ្រើសរើសអតិថិជន --</option>';
    
    if (customersCache.length === 0) {
        const res = await fetch('/api/customers');
        const json = await res.json();
        if (json.success) customersCache = json.data;
    }

    customersCache.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.customer_id;
        opt.textContent = `${c.name} (${c.customer_id}) - ${c.meter_number}`;
        select.appendChild(opt);
    });

    if (preselectedCustId) {
        select.value = preselectedCustId;
        handleSelectCustomerForReading(preselectedCustId);
    }

    document.getElementById('modalReading').classList.add('active');
}

function openReadingModalForCustomer(custId) {
    openReadingModal(custId);
}

async function handleSelectCustomerForReading(custId) {
    if (!custId) {
        document.getElementById('custPreviewBox').style.display = 'none';
        document.getElementById('readOld').value = '';
        calculateLiveUnits();
        return;
    }

    try {
        const res = await fetch(`/api/customers/${custId}/latest-reading`);
        const json = await res.json();

        if (json.success) {
            const meter = json.customer.meter_number;
            const suggestedOld = json.suggested_old_reading || 0;
            
            document.getElementById('previewMeter').textContent = meter;
            document.getElementById('previewLastReading').textContent = `${formatNumber(suggestedOld)} kWh`;
            document.getElementById('custPreviewBox').style.display = 'flex';

            // Auto-fill old reading!
            document.getElementById('readOld').value = suggestedOld;
            document.getElementById('readNew').focus();
            calculateLiveUnits();
        }
    } catch (err) {
        console.error('Error fetching customer reading:', err);
    }
}

function calculateLiveUnits() {
    const oldVal = parseFloat(document.getElementById('readOld').value) || 0;
    const newVal = parseFloat(document.getElementById('readNew').value) || 0;
    const rate = parseFloat(document.getElementById('ratePerUnit').value) || 800;

    let units = newVal - oldVal;
    if (units < 0) {
        document.getElementById('liveTotalUnits').textContent = 'មិនត្រឹមត្រូវ';
        document.getElementById('liveTotalUnits').style.color = '#ef4444';
        document.getElementById('liveTotalAmount').textContent = '0';
        document.getElementById('liveUsdAmount').textContent = '$0.00';
        return;
    }

    document.getElementById('liveTotalUnits').style.color = '';
    document.getElementById('liveTotalUnits').textContent = formatNumber(units);

    const totalAmount = Math.round(units * rate);
    document.getElementById('liveTotalAmount').textContent = Number(totalAmount).toLocaleString('en-US');
    document.getElementById('liveUsdAmount').textContent = formatUSD(totalAmount);
}

function updateRate(newRate) {
    document.getElementById('liveRateDisplay').textContent = newRate || 800;
    calculateLiveUnits();
}

function toggleInvoiceOptions(checked) {
    document.getElementById('invoiceOptionsRow').style.display = checked ? 'grid' : 'none';
}

async function handleSaveReading(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveReading');
    btn.disabled = true;
    btn.textContent = 'កំពុងរក្សាទុក...';

    const oldVal = parseFloat(document.getElementById('readOld').value);
    const newVal = parseFloat(document.getElementById('readNew').value);

    if (newVal < oldVal) {
        showToast('លេខកុងទ័រថ្មី មិនអាចតូចជាងលេខកុងទ័រចាស់បានទេ!', 'error');
        btn.disabled = false;
        btn.textContent = '⚡ រក្សាទុក & ចេញវិក្កយបត្រ';
        return;
    }

    const payload = {
        reading_id: document.getElementById('readID').value.trim(),
        customer_id: document.getElementById('readCustomer').value,
        month_year: document.getElementById('readMonthYear').value.trim(),
        old_reading: oldVal,
        new_reading: newVal,
        rate_per_unit: parseFloat(document.getElementById('ratePerUnit').value) || 800,
        due_date: document.getElementById('dueDate').value,
        auto_generate_invoice: document.getElementById('autoInvoiceCheck').checked
    };

    try {
        const res = await fetch('/api/readings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            showToast(`កត់ត្រាជោគជ័យ! ថាមពលប្រើប្រាស់: ${json.total_units} kWh`, 'success');
            closeModal('modalReading');
            loadReadings();
            loadInvoices();
            loadDashboardStats();

            // Offer to view invoice if generated
            if (json.invoice_id) {
                setTimeout(() => {
                    if (confirm(`បានបង្កើតវិក្កយបត្រលេខ ${json.invoice_id} រួចរាល់! តើអ្នកចង់បើកមើល និងបោះពុម្ពឥឡូវនេះទេ?`)) {
                        window.open(`/invoice/${json.invoice_id}`, '_blank');
                    }
                }, 400);
            }
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការកត់ត្រា', 'error');
        }
    } catch (err) {
        showToast('Connection error: ' + err, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ រក្សាទុក & ចេញវិក្កយបត្រ';
    }
}

// ----------------- Invoices & Payments Management -----------------
function doInvoiceSearch() {
    const input = document.getElementById('invoiceSearchInput');
    const val = input ? input.value.trim() : '';
    clearTimeout(invoiceSearchTimer);
    loadInvoices(invoiceStatusFilter, val);
}

function handleInvoiceInputSearch() {
    const input = document.getElementById('invoiceSearchInput');
    const clearBtn = document.getElementById('btnInvoiceSearchClear');
    const val = input ? input.value : '';
    if (clearBtn) clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
    clearTimeout(invoiceSearchTimer);
    invoiceSearchTimer = setTimeout(() => {
        loadInvoices(invoiceStatusFilter, val.trim());
    }, 250);
}

function handleInvoiceSearchKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(invoiceSearchTimer);
        doInvoiceSearch();
    } else if (event.key === 'Escape') {
        clearInvoiceSearch();
    }
}

function clearInvoiceSearch() {
    const input = document.getElementById('invoiceSearchInput');
    const clearBtn = document.getElementById('btnInvoiceSearchClear');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    clearTimeout(invoiceSearchTimer);
    loadInvoices(invoiceStatusFilter, '');
}

async function loadInvoices(status = 'all', search = null) {
    if (search === null || typeof search !== 'string') {
        const input = document.getElementById('invoiceSearchInput');
        search = input ? input.value.trim() : '';
    }
    const clearBtn = document.getElementById('btnInvoiceSearchClear');
    if (clearBtn) clearBtn.style.display = search.length > 0 ? 'inline-flex' : 'none';

    try {
        let params = [];
        if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        const url = params.length > 0 ? `/api/invoices?${params.join('&')}` : '/api/invoices';

        const res = await fetch(url);
        const json = await res.json();
        const tbody = document.getElementById('invoicesTableBody');

        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(inv => `
                <tr>
                    <td><strong><a href="/invoice/${inv.invoice_id}" target="_blank" style="color:#0284c7;">${inv.invoice_id}</a></strong></td>
                    <td><strong>${inv.customer_name}</strong></td>
                    <td><span class="badge" style="background:#f1f5f9; color:#334155;">${inv.meter_number}</span></td>
                    <td>${inv.month_year}</td>
                    <td><strong>${formatNumber(inv.total_units)}</strong> kWh</td>
                    <td>${formatKHR(inv.rate_per_unit)}</td>
                    <td><strong style="color:#0f172a; font-size:1.05rem;">${formatKHR(inv.total_amount)}</strong></td>
                    <td><span style="color:#e11d48; font-weight:600;">${inv.due_date}</span></td>
                    <td>
                        <span class="badge ${inv.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}" 
                              onclick="toggleInvoiceStatus('${inv.invoice_id}')" title="ចុចដើម្បីប្តូរស្ថានភាព">
                            ${inv.status === 'Paid' ? '✓ បង់រួច' : '⏳ មិនទាន់បង់'}
                        </span>
                    </td>
                    <td>
                        <a href="/invoice/${inv.invoice_id}" target="_blank" class="btn btn-sm btn-primary">
                            🖨️ មើល / PDF (KHQR)
                        </a>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center" style="padding:36px 20px;">
                        <div style="font-size:2.2rem; margin-bottom:8px;">🔍</div>
                        <div style="color:#94a3b8; font-size:0.95rem;">
                            ${search ? `រកមិនឃើញវិក្កយបត្រណាដែលត្រូវនឹង "<strong>${search}</strong>" ឡើយ!` : 'មិនមានវិក្កយបត្រក្នុងប្រភេទនេះឡើយ'}
                        </div>
                        ${search ? `<button class="btn btn-sm btn-outline" style="margin-top:12px;" onclick="clearInvoiceSearch()">បង្ហាញវិក្កយបត្រទាំងអស់</button>` : ''}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loading invoices:', err);
    }
}

function filterInvoices(status) {
    invoiceStatusFilter = status;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === status);
    });
    const input = document.getElementById('invoiceSearchInput');
    const searchVal = input ? input.value.trim() : '';
    loadInvoices(status, searchVal);
}

async function toggleInvoiceStatus(invoiceId, isDashboard = false) {
    try {
        const res = await fetch(`/api/invoices/${invoiceId}/toggle-status`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            showToast(`បានប្តូរស្ថានភាពទៅជា "${json.new_status === 'Paid' ? 'បង់រួច' : 'មិនទាន់បង់'}"`, 'success');
            loadInvoices(invoiceStatusFilter);
            loadDashboardStats();
            if (isDashboard) loadDashboardTables();
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការប្តូរស្ថានភាព', 'error');
        }
    } catch (err) {
        showToast('Connection error: ' + err, 'error');
    }
}

// ----------------- Modal Utility -----------------
function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

/* ==========================================================================
   UNIVERSAL CUSTOMER PICKER MODAL
   ========================================================================== */
let pickerTarget = null; // 'E01', 'E02', 'E03', 'E04', 'E05'

async function openCustomerPickerFor(target) {
    pickerTarget = target;
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const input = document.getElementById('pickerSearchInput');
    if (input) input.value = '';
    renderPickerTable(customersCache);
    const modal = document.getElementById('modalCustomerPicker');
    if (modal) modal.classList.add('active');
    setTimeout(() => { if (input) input.focus(); }, 150);
}

function filterCustomerPicker() {
    const q = (document.getElementById('pickerSearchInput').value || '').trim().toLowerCase();
    if (!q) {
        renderPickerTable(customersCache);
        return;
    }
    const filtered = customersCache.filter(c => 
        (c.customer_id && c.customer_id.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.meter_number && c.meter_number.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
    renderPickerTable(filtered);
}

function renderPickerTable(list) {
    const tbody = document.getElementById('pickerCustomerList');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px; color:#94a3b8;">រកមិនឃើញអតិថិជនឡើយ</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(c => `
        <tr>
            <td><strong>${c.customer_id}</strong></td>
            <td><strong>${c.name}</strong></td>
            <td><span class="badge" style="background:#f1f5f9; color:#334155;">${c.meter_number || '-'}</span></td>
            <td>${c.phone || '-'}</td>
            <td><small>${c.address || '-'}</small></td>
            <td style="text-align:center;">
                <button type="button" class="e01-btn e01-btn-primary" style="padding:2px 10px; font-size:11px;" onclick="selectCustomerFromPicker('${c.customer_id}')">ជ្រើសរើស</button>
            </td>
        </tr>
    `).join('');
}

function selectCustomerFromPicker(custId) {
    closeModal('modalCustomerPicker');
    if (pickerTarget === 'E01') {
        fetchCustomerForEdit(custId);
    } else if (pickerTarget === 'E02') {
        openE02Modal(custId);
    } else if (pickerTarget === 'E03') {
        openE03Modal(custId);
    } else if (pickerTarget === 'E03Tab') {
        populateE03TabCustomer(custId);
    } else if (pickerTarget === 'E04') {
        const cust = customersCache.find(c => c.customer_id === custId);
        if (cust) {
            document.getElementById('e04CustID').value = cust.customer_id;
            document.getElementById('e04CustName').value = cust.name;
            loadE04Receipts();
        }
    } else if (pickerTarget === 'E05') {
        const cust = customersCache.find(c => c.customer_id === custId);
        if (cust) {
            document.getElementById('e05CustID').value = cust.customer_id;
            document.getElementById('e05CustName').value = cust.name;
            loadE05Receipts();
        }
    }
}

/* ==========================================================================
   E02: METER READING CONTROLLER (បញ្ចូលការប្រើប្រាស់)
   ========================================================================== */
let currentE02Customer = null;

async function openE02Modal(customerId = null) {
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const modal = document.getElementById('modalE02Reading');
    if (!modal) return;

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    document.getElementById('e02MonthYear').value = `${mm}/${yyyy}`;

    const dFrom = `${yyyy}-${mm}-01`;
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
    const dTo = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
    document.getElementById('e02DateFrom').value = dFrom;
    document.getElementById('e02DateTo').value = dTo;
    document.getElementById('e02Multiplier').value = '1';
    document.getElementById('e02MeterCycled').checked = false;

    if (!customerId && customersCache.length > 0) {
        customerId = customersCache[0].customer_id;
    }

    if (customerId) {
        await populateE02Customer(customerId);
    }

    modal.classList.add('active');
    setTimeout(() => {
        const newReadingInput = document.getElementById('e02NewReading');
        if (newReadingInput) newReadingInput.focus();
    }, 150);
}

// Redirect standard reading modal to E02
async function openReadingModal(preselectedCustId = null) {
    await openE02Modal(preselectedCustId);
}

async function populateE02Customer(custId) {
    const cust = customersCache.find(c => c.customer_id === custId);
    if (!cust) return;
    currentE02Customer = cust;

    document.getElementById('e02CustID').value = cust.customer_id;
    document.getElementById('e02CustName').value = cust.name || '';
    document.getElementById('e02MeterID').value = cust.meter_number || '';
    document.getElementById('e02Location').value = cust.address || '';

    try {
        const res = await fetch(`/api/customers/${custId}/latest-reading`);
        const json = await res.json();
        const oldReading = json.success ? (json.suggested_old_reading || 0) : 0;
        document.getElementById('e02OldReading').value = oldReading;
        document.getElementById('e02NewReading').value = '';
        document.getElementById('e02TotalUnits').value = '0';
    } catch (e) {
        console.error('Error fetching latest reading:', e);
        document.getElementById('e02OldReading').value = '0';
    }
}

function calculateE02Units() {
    const oldReading = parseFloat(document.getElementById('e02OldReading').value) || 0;
    const newReading = parseFloat(document.getElementById('e02NewReading').value) || 0;
    const mult = parseFloat(document.getElementById('e02Multiplier').value) || 1;
    const cycled = document.getElementById('e02MeterCycled').checked;

    let diff = 0;
    if (cycled) {
        diff = (100000 - oldReading) + newReading;
    } else {
        diff = newReading - oldReading;
    }
    const units = Math.max(0, diff * mult);
    document.getElementById('e02TotalUnits').value = units.toFixed(1);
}

async function handleSaveE02Reading(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveE02');
    btn.disabled = true;
    btn.textContent = 'កំពុងរក្សាទុក...';

    const custId = document.getElementById('e02CustID').value;
    const monthYear = document.getElementById('e02MonthYear').value.trim();
    const oldReading = parseFloat(document.getElementById('e02OldReading').value) || 0;
    const newReading = parseFloat(document.getElementById('e02NewReading').value) || 0;
    const mult = parseFloat(document.getElementById('e02Multiplier').value) || 1;
    const cycled = document.getElementById('e02MeterCycled').checked;
    const billingCycle = document.getElementById('e02BillingCycle').value;
    const recordedBy = document.getElementById('e02RecordedBy').value.trim() || 'admin';
    const dateFrom = document.getElementById('e02DateFrom').value;
    const dateTo = document.getElementById('e02DateTo').value;

    if (!cycled && newReading < oldReading) {
        showToast('លេខកុងទ័រថ្មីមិនអាចតូចជាងលេខកុងទ័រចាស់ទេ (ឬគូសធីក "នាឡិកាស្ទង់វិលដល់ជុំថ្មី")', 'error');
        btn.disabled = false;
        btn.textContent = '💾 រក្សាទុក';
        return;
    }

    try {
        const res = await fetch('/api/readings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: custId,
                month_year: monthYear,
                old_reading: oldReading,
                new_reading: newReading,
                multiplier: mult,
                meter_cycled: cycled ? 1 : 0,
                billing_cycle: billingCycle,
                recorded_by: recordedBy,
                usage_date_from: dateFrom,
                usage_date_to: dateTo,
                rate_per_unit: 800,
                auto_generate_invoice: true
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`បានបញ្ចូលការប្រើប្រាស់ជោគជ័យ! (${json.total_units} kWh)`, 'success');
            loadReadings();
            loadInvoices();
            loadDashboardStats();

            const autoNext = document.getElementById('e02NextCustomerAuto').checked;
            if (autoNext && customersCache.length > 1) {
                const currentIndex = customersCache.findIndex(c => c.customer_id === custId);
                const nextIndex = (currentIndex + 1) % customersCache.length;
                populateE02Customer(customersCache[nextIndex].customer_id);
                setTimeout(() => {
                    const inp = document.getElementById('e02NewReading');
                    if (inp) inp.focus();
                }, 100);
            } else {
                closeModal('modalE02Reading');
            }
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការរក្សាទុក', 'error');
        }
    } catch (e) {
        showToast('Connection error: ' + e, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 រក្សាទុក';
    }
}

async function showUnrecordedCustomersModal() {
    const month = document.getElementById('e02MonthYear').value.trim();
    document.getElementById('unrecordedMonthDisplay').textContent = month;
    document.getElementById('modalUnrecordedCustomers').classList.add('active');
    await loadUnrecordedCustomers();
}

async function loadUnrecordedCustomers() {
    const month = document.getElementById('e02MonthYear').value.trim();
    const tbody = document.getElementById('unrecordedListBody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px;">កំពុងទាញយកទិន្នន័យ...</td></tr>`;

    try {
        const res = await fetch(`/api/customers/unrecorded?month=${encodeURIComponent(month)}`);
        const json = await res.json();
        if (json.success) {
            document.getElementById('unrecordedCountDisplay').textContent = json.total;
            if (json.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:24px; color:#16a34a; font-weight:600;">អតិថិជនទាំងអស់បានកត់ត្រាការប្រើប្រាស់រួចរាល់សម្រាប់ខែនេះ!</td></tr>`;
            } else {
                tbody.innerHTML = json.data.map(c => `
                    <tr>
                        <td><strong>${c.customer_id}</strong></td>
                        <td><strong>${c.name}</strong></td>
                        <td><span class="badge" style="background:#f1f5f9; color:#334155;">${c.meter_number || '-'}</span></td>
                        <td>${c.phone || '-'}</td>
                        <td>${formatNumber(c.suggested_old_reading || 0)} kWh</td>
                        <td style="text-align:center;">
                            <button type="button" class="e01-btn e01-btn-primary" style="padding:2px 10px; font-size:11px;" onclick="selectUnrecordedCustomer('${c.customer_id}')">⚡ បញ្ចូលអំណាន</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red">មានបញ្ហាក្នុងការទាញយក: ${e}</td></tr>`;
    }
}

function selectUnrecordedCustomer(custId) {
    closeModal('modalUnrecordedCustomers');
    populateE02Customer(custId);
}

function showReviewReadingsModal() {
    closeModal('modalE02Reading');
    switchTab('readings');
}

function showCustomerHistory() {
    const custId = document.getElementById('e02CustID').value;
    if (custId) {
        showCustomerDetail(custId);
    } else {
        showToast('សូមជ្រើសរើសអតិថិជនជាមុនសិន!', 'info');
    }
}

/* ==========================================================================
   E03: TAB EMBEDDED PAYMENT FORM CONTROLLER (ទម្រង់បង់ប្រាក់ផ្ទាល់លើ TAB)
   ========================================================================== */
let currentE03TabCustomer = null;
let currentE03TabInvoices = [];

function getFormattedE03DateTime() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
}

async function initE03TabForm(customerId = null) {
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const dateElem = document.getElementById('e03TabDateDisplay');
    if (dateElem) {
        dateElem.textContent = getFormattedE03DateTime();
    }
    
    // Default to first customer if none specified and none currently selected
    if (!customerId && !currentE03TabCustomer && customersCache.length > 0) {
        customerId = customersCache[0].customer_id;
    }

    if (customerId) {
        await populateE03TabCustomer(customerId);
    }
}

async function populateE03TabCustomer(custId) {
    const cust = customersCache.find(c => c.customer_id === custId);
    if (!cust) return;
    currentE03TabCustomer = cust;

    const idInp = document.getElementById('e03TabCustID');
    const nameInp = document.getElementById('e03TabCustName');
    const meterInp = document.getElementById('e03TabMeterID');
    const locInp = document.getElementById('e03TabLocation');
    const dateElem = document.getElementById('e03TabDateDisplay');

    if (idInp) idInp.value = cust.customer_id;
    if (nameInp) nameInp.value = cust.name || '';
    if (meterInp) meterInp.value = cust.meter_number || '';
    if (locInp) locInp.value = cust.address || '';
    if (dateElem) dateElem.textContent = getFormattedE03DateTime();

    await refreshE03TabCustomerInvoices();
}

async function refreshE03TabCustomerInvoices() {
    const custId = document.getElementById('e03TabCustID')?.value;
    if (!custId) return;

    const tbody = document.getElementById('e03TabInvoiceList');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">កំពុងទាញយកវិក្កយបត្រ...</td></tr>`;

    try {
        const res = await fetch(`/api/customers/${custId}/unpaid-invoices`);
        const json = await res.json();
        if (json.success) {
            currentE03TabInvoices = json.invoices || [];
            renderE03TabInvoiceTable(currentE03TabInvoices);
        } else {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">${json.error || 'មានបញ្ហា'}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">Connection error: ${e}</td></tr>`;
    }
}

function renderE03TabInvoiceTable(invoices) {
    const tbody = document.getElementById('e03TabInvoiceList');
    if (!tbody) return;

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:22px; color:#16a34a; font-weight:600;">អតិថិជននេះគ្មានវិក្កយបត្រជំពាក់ឡើយ! (No Unpaid Invoices)</td></tr>`;
        const totalDueElem = document.getElementById('e03TabTotalDueDisplay');
        const amountInp = document.getElementById('e03TabAmountPaidInput');
        const balanceElem = document.getElementById('e03TabBalanceDisplay');
        if (totalDueElem) totalDueElem.textContent = '0 ៛';
        if (amountInp) amountInp.value = 0;
        if (balanceElem) {
            balanceElem.textContent = '0 ៛';
            balanceElem.className = 'e03-calc-val text-emerald';
        }
        return;
    }

    tbody.innerHTML = invoices.map(inv => `
        <tr>
            <td style="text-align: center;">
                <input type="checkbox" class="e03-tab-inv-chk e01-chk" value="${inv.invoice_id}" data-amount="${inv.total_amount}" checked onchange="calculateE03TabPayment()">
            </td>
            <td><strong>${inv.invoice_id}</strong></td>
            <td>${inv.month_year}</td>
            <td style="text-align: right;">${formatNumber(inv.total_units)} kWh</td>
            <td style="text-align: right;"><strong style="color:#b91c1c;">${formatKHR(inv.total_amount)}</strong></td>
            <td style="text-align: right;">${formatKHR(inv.total_amount)}</td>
            <td style="text-align: right; color:#b91c1c; font-weight:700;">${formatKHR(inv.total_amount)}</td>
            <td><span class="badge badge-unpaid">⏳ មិនទាន់បង់</span></td>
        </tr>
    `).join('');

    calculateE03TabPayment(true);
}

function toggleSelectAllE03Tab(checked) {
    document.querySelectorAll('.e03-tab-inv-chk').forEach(chk => chk.checked = checked);
    calculateE03TabPayment();
}

function calculateE03TabPayment(isInit = false) {
    const chks = document.querySelectorAll('.e03-tab-inv-chk:checked');
    let totalDue = 0;
    chks.forEach(chk => {
        totalDue += parseFloat(chk.getAttribute('data-amount')) || 0;
    });

    const currencyElem = document.getElementById('e03TabCurrency');
    const currency = currencyElem ? currencyElem.value : 'KHR';
    const displayDue = currency === 'USD' ? formatUSD(totalDue) : formatKHR(totalDue);
    
    const totalDueElem = document.getElementById('e03TabTotalDueDisplay');
    if (totalDueElem) totalDueElem.textContent = displayDue;

    const amountInp = document.getElementById('e03TabAmountPaidInput');
    const autoFill = document.getElementById('e03TabAutoFill')?.checked;

    if (amountInp && (isInit || autoFill)) {
        amountInp.value = totalDue;
    }

    const paid = parseFloat(amountInp?.value) || 0;
    const balance = paid - totalDue;
    const balanceElem = document.getElementById('e03TabBalanceDisplay');
    if (balanceElem) {
        if (balance >= 0) {
            balanceElem.textContent = currency === 'USD' ? formatUSD(balance) : formatKHR(balance);
            balanceElem.className = 'e03-calc-val text-emerald';
        } else {
            balanceElem.textContent = 'នៅខ្វះ ' + (currency === 'USD' ? formatUSD(Math.abs(balance)) : formatKHR(Math.abs(balance)));
            balanceElem.className = 'e03-calc-val text-red';
        }
    }
}

function handleE03TabMethodChange() {
    const methodElem = document.getElementById('e03TabMethod');
    const accountSelect = document.getElementById('e03TabAccount');
    if (!methodElem || !accountSelect) return;
    const method = methodElem.value;
    if (method === 'សាច់ប្រាក់ក្នុងកេះ') {
        accountSelect.value = 'គណនីសាច់ប្រាក់ទទួលពីអតិថិជន';
    } else if (method === 'KHQR') {
        accountSelect.value = 'ABA: 001 234 567 (អគ្គិសនី រតនគិរី)';
    } else {
        accountSelect.value = 'Canadia: 005 888 999';
    }
}

async function handleSaveE03TabPayment() {
    const custId = document.getElementById('e03TabCustID')?.value;
    if (!custId) {
        showToast('សូមជ្រើសរើសអតិថិជនជាមុនសិន!', 'error');
        return;
    }

    const chks = document.querySelectorAll('.e03-tab-inv-chk:checked');
    if (chks.length === 0) {
        showToast('សូមជ្រើសរើសវិក្កយបត្រយ៉ាងហោចណាស់ ១ ដើម្បីបង់ប្រាក់!', 'error');
        return;
    }

    const invoiceIds = Array.from(chks).map(c => c.value);
    const amountPaid = parseFloat(document.getElementById('e03TabAmountPaidInput')?.value) || 0;
    const currency = document.getElementById('e03TabCurrency')?.value || 'KHR';
    const method = document.getElementById('e03TabMethod')?.value || 'សាច់ប្រាក់ក្នុងកេះ';
    const account = document.getElementById('e03TabAccount')?.value || 'គណនីសាច់ប្រាក់ទទួលពីអតិថិជន';
    const autoPrint = document.getElementById('e03TabAutoPrint')?.checked;

    const btn = document.getElementById('btnConfirmE03Tab');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'កំពុងបង់ប្រាក់...';
    }

    try {
        const res = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: custId,
                invoice_ids: invoiceIds,
                amount_paid: amountPaid,
                currency: currency,
                payment_method: method,
                account_name: account,
                cashier: 'admin'
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`បានទូទាត់ប្រាក់ជោគជ័យ! បង្កាន់ដៃលេខ: ${json.receipt_id}`, 'success');
            
            // Reload the payments table right below the form so it displays the new payment immediately
            await loadPaymentsTable();
            loadInvoices();
            loadDashboardStats();

            // Refresh the form table
            await refreshE03TabCustomerInvoices();

            if (autoPrint && json.receipt_id) {
                printReceipt(json.receipt_id);
            }
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការបង់ប្រាក់', 'error');
        }
    } catch (e) {
        showToast('Connection error: ' + e, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✔️ យល់ព្រម (បង់ប្រាក់)';
        }
    }
}

function resetE03TabForm() {
    currentE03TabCustomer = null;
    currentE03TabInvoices = [];
    const custIdElem = document.getElementById('e03TabCustID');
    const custNameElem = document.getElementById('e03TabCustName');
    const meterElem = document.getElementById('e03TabMeterID');
    const locElem = document.getElementById('e03TabLocation');
    const dateElem = document.getElementById('e03TabDateDisplay');
    const totalDueElem = document.getElementById('e03TabTotalDueDisplay');
    const amountInp = document.getElementById('e03TabAmountPaidInput');
    const balanceElem = document.getElementById('e03TabBalanceDisplay');
    const tbody = document.getElementById('e03TabInvoiceList');

    if (custIdElem) custIdElem.value = '';
    if (custNameElem) custNameElem.value = '';
    if (meterElem) meterElem.value = '';
    if (locElem) locElem.value = '';
    if (dateElem) dateElem.textContent = getFormattedE03DateTime();
    if (totalDueElem) totalDueElem.textContent = '0 ៛';
    if (amountInp) amountInp.value = '';
    if (balanceElem) {
        balanceElem.textContent = '0 ៛';
        balanceElem.className = 'e03-calc-val text-emerald';
    }
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 22px; color: #64748b;">សូមជ្រើសរើសអតិថិជនដើម្បីទាញយកបញ្ជីវិក្កយបត្រត្រូវទូទាត់</td></tr>`;
    }
    showToast('បានសម្អាតទម្រង់បង់ប្រាក់រួចរាល់', 'info');
}

/* ==========================================================================
   E03: PAYMENTS CONTROLLER (បង់ប្រាក់)
   ========================================================================== */
let currentE03Customer = null;
let currentE03Invoices = [];

async function openE03Modal(customerId = null) {
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const modal = document.getElementById('modalE03Payment');
    if (!modal) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('km-KH') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('e03DateDisplay').textContent = dateStr;
    document.getElementById('e03AmountPaidInput').value = '';
    document.getElementById('e03TotalDueDisplay').textContent = '0 ៛';
    document.getElementById('e03BalanceDisplay').textContent = '0 ៛';

    if (!customerId && customersCache.length > 0) {
        customerId = customersCache[0].customer_id;
    }

    if (customerId) {
        await populateE03Customer(customerId);
    }

    modal.classList.add('active');
}

async function populateE03Customer(custId) {
    const cust = customersCache.find(c => c.customer_id === custId);
    if (!cust) return;
    currentE03Customer = cust;

    document.getElementById('e03CustID').value = cust.customer_id;
    document.getElementById('e03CustName').value = cust.name || '';
    document.getElementById('e03MeterID').value = cust.meter_number || '';

    await refreshE03CustomerInvoices();
}

async function refreshE03CustomerInvoices() {
    const custId = document.getElementById('e03CustID').value;
    if (!custId) return;

    const tbody = document.getElementById('e03InvoiceList');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px;">កំពុងទាញយកវិក្កយបត្រ...</td></tr>`;

    try {
        const res = await fetch(`/api/customers/${custId}/unpaid-invoices`);
        const json = await res.json();
        if (json.success) {
            currentE03Invoices = json.invoices;
            renderE03InvoiceTable(currentE03Invoices);
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red">${json.error || 'មានបញ្ហា'}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red">Connection error: ${e}</td></tr>`;
    }
}

function renderE03InvoiceTable(invoices) {
    const tbody = document.getElementById('e03InvoiceList');
    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:24px; color:#16a34a; font-weight:600;">អតិថិជននេះគ្មានវិក្កយបត្រជំពាក់ឡើយ! (No Unpaid Invoices)</td></tr>`;
        document.getElementById('e03TotalDueDisplay').textContent = '0 ៛';
        document.getElementById('e03AmountPaidInput').value = 0;
        document.getElementById('e03BalanceDisplay').textContent = '0 ៛';
        return;
    }

    tbody.innerHTML = invoices.map(inv => `
        <tr>
            <td style="text-align: center;">
                <input type="checkbox" class="e03-inv-chk e01-chk" value="${inv.invoice_id}" data-amount="${inv.total_amount}" checked onchange="calculateE03Payment()">
            </td>
            <td><strong>${inv.invoice_id}</strong></td>
            <td>${inv.month_year}</td>
            <td style="text-align: right;">${formatNumber(inv.total_units)} kWh</td>
            <td style="text-align: right;"><strong style="color:#b91c1c;">${formatKHR(inv.total_amount)}</strong></td>
            <td><span style="color:#e11d48; font-size:11px;">${inv.due_date}</span></td>
            <td><span class="badge badge-unpaid">⏳ មិនទាន់បង់</span></td>
        </tr>
    `).join('');

    calculateE03Payment(true);
}

function toggleSelectAllE03(checked) {
    document.querySelectorAll('.e03-inv-chk').forEach(chk => chk.checked = checked);
    calculateE03Payment();
}

function calculateE03Payment(isInit = false) {
    const chks = document.querySelectorAll('.e03-inv-chk:checked');
    let totalDue = 0;
    chks.forEach(chk => {
        totalDue += parseFloat(chk.getAttribute('data-amount')) || 0;
    });

    const currency = document.getElementById('e03Currency').value;
    const displayDue = currency === 'USD' ? formatUSD(totalDue) : formatKHR(totalDue);
    document.getElementById('e03TotalDueDisplay').textContent = displayDue;

    if (isInit) {
        document.getElementById('e03AmountPaidInput').value = totalDue;
    }

    const paid = parseFloat(document.getElementById('e03AmountPaidInput').value) || 0;
    const balance = paid - totalDue;
    const balanceElem = document.getElementById('e03BalanceDisplay');
    if (balance >= 0) {
        balanceElem.textContent = currency === 'USD' ? formatUSD(balance) : formatKHR(balance);
        balanceElem.className = 'e03-calc-val text-emerald';
    } else {
        balanceElem.textContent = 'នៅខ្វះ ' + (currency === 'USD' ? formatUSD(Math.abs(balance)) : formatKHR(Math.abs(balance)));
        balanceElem.className = 'e03-calc-val text-red';
    }
}

function handleE03MethodChange() {
    const method = document.getElementById('e03Method').value;
    const accountSelect = document.getElementById('e03Account');
    if (method === 'សាច់ប្រាក់សុទ្ធ') {
        accountSelect.value = 'បេឡាសាច់ប្រាក់';
    } else if (method === 'KHQR') {
        accountSelect.value = 'ABA: 001 234 567';
    } else {
        accountSelect.value = 'Canadia: 005 888 999';
    }
}

async function handleSaveE03Payment() {
    const custId = document.getElementById('e03CustID').value;
    const chks = document.querySelectorAll('.e03-inv-chk:checked');
    if (chks.length === 0) {
        showToast('សូមជ្រើសរើសវិក្កយបត្រយ៉ាងហោចណាស់ ១ ដើម្បីបង់ប្រាក់!', 'error');
        return;
    }

    const invoiceIds = Array.from(chks).map(c => c.value);
    const amountPaid = parseFloat(document.getElementById('e03AmountPaidInput').value) || 0;
    const currency = document.getElementById('e03Currency').value;
    const method = document.getElementById('e03Method').value;
    const account = document.getElementById('e03Account').value;
    const autoPrint = document.getElementById('e03AutoPrint').checked;

    const btn = document.getElementById('btnConfirmE03');
    btn.disabled = true;
    btn.textContent = 'កំពុងបង់ប្រាក់...';

    try {
        const res = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: custId,
                invoice_ids: invoiceIds,
                amount_paid: amountPaid,
                currency: currency,
                payment_method: method,
                account_name: account,
                cashier: 'admin'
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`បង់ប្រាក់ជោគជ័យ! បង្កាន់ដៃលេខ: ${json.receipt_id}`, 'success');
            closeModal('modalE03Payment');
            loadPaymentsTable();
            loadInvoices();
            loadDashboardStats();

            if (autoPrint && json.receipt_id) {
                printReceipt(json.receipt_id);
            }
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការបង់ប្រាក់', 'error');
        }
    } catch (e) {
        showToast('Connection error: ' + e, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✔️ យល់ព្រម (Confirm)';
    }
}

async function loadPaymentsTable(search = '') {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`/api/payments?search=${encodeURIComponent(search)}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => `
                <tr>
                    <td><strong><a href="/receipt/${p.receipt_id}" target="_blank" style="color:#0284c7;">${p.receipt_id}</a></strong></td>
                    <td>${p.payment_date}</td>
                    <td><strong>${p.customer_name}</strong> <small>(${p.customer_id})</small></td>
                    <td><span class="badge" style="background:#f1f5f9; color:#334155;">${p.item_count || 1} វិក្កយបត្រ</span></td>
                    <td>${p.payment_method}</td>
                    <td><strong style="color:#059669; font-size:1.05rem;">${formatKHR(p.amount_paid)}</strong></td>
                    <td>${p.cashier}</td>
                    <td>
                        <span class="badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">
                            ${p.status === 'Paid' ? '✓ បង់រួច' : '🗑️ បានលុប'}
                        </span>
                    </td>
                    <td>
                        <button type="button" class="btn btn-sm btn-primary" onclick="printReceipt('${p.receipt_id}')">🖨️ បង្កាន់ដៃ</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:30px; color:#94a3b8;">មិនមានទិន្នន័យបង់ប្រាក់ឡើយ</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-red">មានបញ្ហាក្នុងការទាញយកទិន្នន័យ</td></tr>`;
    }
}

function doPaymentSearch() {
    const val = (document.getElementById('paymentSearchInput').value || '').trim();
    loadPaymentsTable(val);
}

function handlePaymentInputSearch() {
    const input = document.getElementById('paymentSearchInput');
    const clearBtn = document.getElementById('btnPaymentSearchClear');
    const val = input ? input.value : '';
    if (clearBtn) clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(() => {
        loadPaymentsTable(val.trim());
    }, 250);
}

function handlePaymentSearchKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        doPaymentSearch();
    } else if (event.key === 'Escape') {
        clearPaymentSearch();
    }
}

function clearPaymentSearch() {
    const input = document.getElementById('paymentSearchInput');
    const clearBtn = document.getElementById('btnPaymentSearchClear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    loadPaymentsTable('');
}

/* ==========================================================================
   E04: PRINT RECEIPTS CONTROLLER (បោះពុម្ពបង្កាន់ដៃ)
   ========================================================================== */
let selectedE04ReceiptId = null;

async function openE04Modal(customerId = null) {
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const modal = document.getElementById('modalE04Receipt');
    if (!modal) return;

    if (customerId) {
        const cust = customersCache.find(c => c.customer_id === customerId);
        if (cust) {
            document.getElementById('e04CustID').value = cust.customer_id;
            document.getElementById('e04CustName').value = cust.name;
        }
    }

    modal.classList.add('active');
    await loadE04Receipts();
}

async function loadE04Receipts() {
    const custId = (document.getElementById('e04CustID').value || '').trim();
    const custName = (document.getElementById('e04CustName').value || '').trim();
    const month = (document.getElementById('e04Month').value || '').trim();

    const tbody = document.getElementById('e04ReceiptList');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:20px;">កំពុងទាញយកទិន្នន័យ...</td></tr>`;

    let params = [];
    if (custId) params.push(`customer_id=${encodeURIComponent(custId)}`);
    if (custName) params.push(`search=${encodeURIComponent(custName)}`);
    if (month) params.push(`month=${encodeURIComponent(month)}`);

    try {
        const url = params.length > 0 ? `/api/payments?${params.join('&')}` : '/api/payments';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map((p, idx) => `
                <tr onclick="selectE04Row('${p.receipt_id}')" style="cursor:pointer;">
                    <td style="text-align: center;">
                        <input type="radio" name="e04Radio" value="${p.receipt_id}" ${idx === 0 ? 'checked' : ''} onchange="selectedE04ReceiptId = '${p.receipt_id}'">
                    </td>
                    <td><strong>${p.receipt_id}</strong></td>
                    <td>${p.payment_date}</td>
                    <td><strong>${p.customer_name}</strong></td>
                    <td><span class="badge" style="background:#f1f5f9; color:#334155;">${p.invoices_summary || '1 វិក្កយបត្រ'}</span></td>
                    <td style="text-align: right;"><strong style="color:#059669;">${formatKHR(p.amount_paid)}</strong></td>
                    <td>${p.payment_method}</td>
                    <td>${p.cashier}</td>
                    <td>
                        <button type="button" class="e01-btn e01-btn-primary" style="padding:2px 8px; font-size:11px;" onclick="printReceipt('${p.receipt_id}')">🖨️ បោះពុម្ព</button>
                    </td>
                </tr>
            `).join('');
            selectedE04ReceiptId = json.data[0].receipt_id;
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:24px; color:#94a3b8;">មិនមានបង្កាន់ដៃទូទាត់ឡើយ</td></tr>`;
            selectedE04ReceiptId = null;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-red">មានបញ្ហាក្នុងការទាញយក: ${e}</td></tr>`;
    }
}

function selectE04Row(receiptId) {
    selectedE04ReceiptId = receiptId;
    const radio = document.querySelector(`input[name="e04Radio"][value="${receiptId}"]`);
    if (radio) radio.checked = true;
}

function resetE04Filter() {
    document.getElementById('e04CustID').value = '';
    document.getElementById('e04CustName').value = '';
    document.getElementById('e04Month').value = '';
    loadE04Receipts();
}

function printSelectedE04Receipt() {
    if (!selectedE04ReceiptId) {
        showToast('សូមជ្រើសរើសបង្កាន់ដៃដែលចង់បោះពុម្ព!', 'error');
        return;
    }
    printReceipt(selectedE04ReceiptId);
}

function printReceipt(receiptId) {
    window.open(`/receipt/${receiptId}`, '_blank');
}

async function loadReceiptsTable(search = '') {
    const tbody = document.getElementById('receiptsTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`/api/payments?search=${encodeURIComponent(search)}&status=Paid`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => `
                <tr>
                    <td><strong><a href="/receipt/${p.receipt_id}" target="_blank" style="color:#0284c7;">${p.receipt_id}</a></strong></td>
                    <td>${p.payment_date}</td>
                    <td><strong>${p.customer_name}</strong> <small>(${p.customer_id})</small></td>
                    <td><span class="badge" style="background:#f1f5f9; color:#334155;">${p.meter_number || '-'}</span></td>
                    <td><strong style="color:#059669; font-size:1.05rem;">${formatKHR(p.amount_paid)}</strong></td>
                    <td>${p.payment_method}</td>
                    <td>${p.cashier}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-primary" onclick="printReceipt('${p.receipt_id}')">🖨️ បោះពុម្ពបង្កាន់ដៃ</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:30px; color:#94a3b8;">មិនមានបង្កាន់ដៃដែលត្រូវបោះពុម្ពឡើយ</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">មានបញ្ហាក្នុងការទាញយកទិន្នន័យ</td></tr>`;
    }
}

function doReceiptSearch() {
    const val = (document.getElementById('receiptSearchInput').value || '').trim();
    loadReceiptsTable(val);
}

function handleReceiptInputSearch() {
    const val = (document.getElementById('receiptSearchInput').value || '').trim();
    loadReceiptsTable(val);
}

/* ==========================================================================
   E05: VOID PAYMENT CONTROLLER (លុបការបង់ប្រាក់)
   ========================================================================== */
let selectedE05ReceiptId = null;

async function openE05Modal(customerId = null) {
    if (customersCache.length === 0) {
        await loadCustomers();
    }
    const modal = document.getElementById('modalE05VoidPayment');
    if (!modal) return;

    if (customerId) {
        const cust = customersCache.find(c => c.customer_id === customerId);
        if (cust) {
            document.getElementById('e05CustID').value = cust.customer_id;
            document.getElementById('e05CustName').value = cust.name;
        }
    }

    document.getElementById('e05VoidReason').value = '';
    document.getElementById('e05QuickReason').value = '';

    modal.classList.add('active');
    await loadE05Receipts();
}

async function loadE05Receipts() {
    const custId = (document.getElementById('e05CustID').value || '').trim();
    const custName = (document.getElementById('e05CustName').value || '').trim();

    const tbody = document.getElementById('e05PaymentList');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">កំពុងទាញយកប្រតិបត្តិការ...</td></tr>`;

    let params = [];
    if (custId) params.push(`customer_id=${encodeURIComponent(custId)}`);
    if (custName) params.push(`search=${encodeURIComponent(custName)}`);
    params.push(`status=Paid`);

    try {
        const res = await fetch(`/api/payments?${params.join('&')}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map((p, idx) => `
                <tr onclick="selectE05Row('${p.receipt_id}')" style="cursor:pointer;">
                    <td style="text-align: center;">
                        <input type="radio" name="e05Radio" value="${p.receipt_id}" ${idx === 0 ? 'checked' : ''} onchange="selectedE05ReceiptId = '${p.receipt_id}'">
                    </td>
                    <td><strong>${p.receipt_id}</strong></td>
                    <td>${p.payment_date}</td>
                    <td><strong>${p.customer_name}</strong></td>
                    <td><span class="badge" style="background:#f1f5f9; color:#334155;">${p.invoices_summary || '1 វិក្កយបត្រ'}</span></td>
                    <td style="text-align: right;"><strong style="color:#b91c1c;">${formatKHR(p.amount_paid)}</strong></td>
                    <td>${p.cashier}</td>
                    <td><span class="badge badge-paid">✓ បង់រួច</span></td>
                </tr>
            `).join('');
            selectedE05ReceiptId = json.data[0].receipt_id;
        } else {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:24px; color:#94a3b8;">គ្មានប្រតិបត្តិការបង់ប្រាក់ដែលអាចលុបបានឡើយ</td></tr>`;
            selectedE05ReceiptId = null;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">មានបញ្ហាក្នុងការទាញយក: ${e}</td></tr>`;
    }
}

function selectE05Row(receiptId) {
    selectedE05ReceiptId = receiptId;
    const radio = document.querySelector(`input[name="e05Radio"][value="${receiptId}"]`);
    if (radio) radio.checked = true;
}

async function handleVoidE05Payment() {
    if (!selectedE05ReceiptId) {
        showToast('សូមជ្រើសរើសបង្កាន់ដៃដែលត្រូវលុប!', 'error');
        return;
    }
    const reason = (document.getElementById('e05VoidReason').value || '').trim();
    if (!reason) {
        showToast('សូមបញ្ជាក់មូលហេតុនៃការលុប!', 'error');
        document.getElementById('e05VoidReason').focus();
        return;
    }

    if (!confirm(`តើអ្នកពិតជាចង់លុបប្រតិបត្តិការបង់ប្រាក់ ${selectedE05ReceiptId} មែនទេ?\nវិក្កយបត្រដែលពាក់ព័ន្ធនឹងត្រូវត្រឡប់ជា "មិនទាន់បង់" វិញ!`)) {
        return;
    }

    const btn = document.getElementById('btnConfirmVoidE05');
    btn.disabled = true;
    btn.textContent = 'កំពុងលុប...';

    try {
        const res = await fetch(`/api/payments/${selectedE05ReceiptId}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: reason,
                cashier: 'admin'
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`បានលុបការបង់ប្រាក់ ${selectedE05ReceiptId} ជោគជ័យ!`, 'success');
            closeModal('modalE05VoidPayment');
            loadVoidPaymentsTable();
            loadPaymentsTable();
            loadInvoices();
            loadDashboardStats();
        } else {
            showToast(json.error || 'មានបញ្ហាក្នុងការលុបការបង់ប្រាក់', 'error');
        }
    } catch (e) {
        showToast('Connection error: ' + e, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🗑️ លុបការបង់ប្រាក់';
    }
}

async function loadVoidPaymentsTable() {
    const tbody = document.getElementById('voidPaymentsTableBody');
    if (!tbody) return;
    try {
        const res = await fetch(`/api/payments`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => `
                <tr>
                    <td><strong>${p.receipt_id}</strong></td>
                    <td>${p.payment_date}</td>
                    <td><strong>${p.customer_name}</strong></td>
                    <td><strong style="color:#0f172a;">${formatKHR(p.amount_paid)}</strong></td>
                    <td>${p.cashier}</td>
                    <td>
                        <span class="badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}" style="${p.status === 'Voided' ? 'background:#fee2e2; color:#b91c1c;' : ''}">
                            ${p.status === 'Paid' ? '✓ បង់រួច' : '🗑️ បានលុប (Voided)'}
                        </span>
                    </td>
                    <td><small style="color:#64748b;">${p.void_reason || '-'}</small></td>
                    <td>
                        ${p.status === 'Paid' ? `<button type="button" class="btn btn-sm btn-outline" style="color:#dc2626; border-color:#fca5a5;" onclick="openE05Modal('${p.customer_id}')">🗑️ លុប</button>` : `<span style="color:#94a3b8; font-size:12px;">និរាករណ៍រួច</span>`}
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:30px; color:#94a3b8;">មិនមានទិន្នន័យឡើយ</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red">មានបញ្ហាក្នុងការទាញយកទិន្នន័យ</td></tr>`;
    }
}

