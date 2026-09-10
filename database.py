import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "electricity.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Customers Table (តារាងអតិថិជន - ផ្ទុកទិន្នន័យគ្រប់ជ្រុងជ្រោយតាមទម្រង់ E01)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            customer_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            honorific TEXT DEFAULT 'លោក',
            last_name TEXT,
            first_name TEXT,
            last_name_en TEXT,
            first_name_en TEXT,
            gender TEXT DEFAULT 'ប្រុស',
            dob TEXT,
            pob TEXT,
            id_type TEXT DEFAULT 'អត្តសញ្ញាណប័ណ្ណ',
            national_id TEXT,
            representative TEXT,
            job TEXT,
            family_count INTEGER DEFAULT 1,
            customer_type TEXT DEFAULT 'បុគ្គលមិនជាប់អាករ',
            is_poor INTEGER DEFAULT 0,
            phone TEXT,
            account_no TEXT,
            province TEXT DEFAULT 'រតនគិរី',
            district TEXT DEFAULT 'បានលុង',
            commune TEXT DEFAULT 'កាចាញ',
            village TEXT DEFAULT 'ភូមិ ២',
            zone TEXT DEFAULT 'បានលុង',
            house_no TEXT,
            street_no TEXT,
            address TEXT,
            meter_number TEXT NOT NULL UNIQUE,
            meter_type TEXT DEFAULT '1-Phase (ធម្មតា 220V)',
            photo TEXT,
            registered_date TEXT NOT NULL
        );
    """)

    # Auto-migration: Check existing columns in customers table and add missing ones
    cursor.execute("PRAGMA table_info(customers)")
    existing_cols = {row["name"] for row in cursor.fetchall()}
    
    new_cols = {
        "honorific": "TEXT DEFAULT 'លោក'",
        "last_name": "TEXT",
        "first_name": "TEXT",
        "last_name_en": "TEXT",
        "first_name_en": "TEXT",
        "gender": "TEXT DEFAULT 'ប្រុស'",
        "dob": "TEXT",
        "pob": "TEXT",
        "id_type": "TEXT DEFAULT 'អត្តសញ្ញាណប័ណ្ណ'",
        "national_id": "TEXT",
        "representative": "TEXT",
        "job": "TEXT",
        "family_count": "INTEGER DEFAULT 1",
        "customer_type": "TEXT DEFAULT 'បុគ្គលមិនជាប់អាករ'",
        "is_poor": "INTEGER DEFAULT 0",
        "account_no": "TEXT",
        "province": "TEXT DEFAULT 'រតនគិរី'",
        "district": "TEXT DEFAULT 'បានលុង'",
        "commune": "TEXT DEFAULT 'កាចាញ'",
        "village": "TEXT DEFAULT 'ភូមិ ២'",
        "zone": "TEXT DEFAULT 'បានលុង'",
        "house_no": "TEXT",
        "street_no": "TEXT",
        "meter_type": "TEXT DEFAULT '1-Phase (ធម្មតា 220V)'",
        "photo": "TEXT"
    }

    for col, col_def in new_cols.items():
        if col not in existing_cols:
            cursor.execute(f"ALTER TABLE customers ADD COLUMN {col} {col_def}")

    # 2. Meter Readings Table (តារាងកត់ត្រាការប្រើប្រាស់)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS meter_readings (
            reading_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            month_year TEXT NOT NULL,
            old_reading REAL NOT NULL,
            new_reading REAL NOT NULL,
            total_units REAL NOT NULL,
            recorded_date TEXT NOT NULL,
            billing_cycle TEXT,
            recorded_by TEXT DEFAULT 'បុគ្គលិកស្រង់លេខ',
            usage_date_from TEXT,
            usage_date_to TEXT,
            meter_cycled INTEGER DEFAULT 0,
            FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE CASCADE
        );
    """)

    # Auto-migration for meter_readings columns
    cursor.execute("PRAGMA table_info(meter_readings)")
    existing_reading_cols = {row["name"] for row in cursor.fetchall()}
    new_reading_cols = {
        "billing_cycle": "TEXT",
        "recorded_by": "TEXT DEFAULT 'បុគ្គលិកស្រង់លេខ'",
        "usage_date_from": "TEXT",
        "usage_date_to": "TEXT",
        "meter_cycled": "INTEGER DEFAULT 0"
    }
    for col, col_def in new_reading_cols.items():
        if col not in existing_reading_cols:
            cursor.execute(f"ALTER TABLE meter_readings ADD COLUMN {col} {col_def}")

    # 3. Invoices & Payments Table (តារាងវិក្កយបត្រ)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            invoice_id TEXT PRIMARY KEY,
            reading_id TEXT NOT NULL UNIQUE,
            rate_per_unit REAL NOT NULL DEFAULT 800,
            total_amount REAL NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Unpaid',
            created_at TEXT NOT NULL,
            FOREIGN KEY (reading_id) REFERENCES meter_readings (reading_id) ON DELETE CASCADE
        );
    """)

    # 4. Payments (Receipts) Table (តារាងបង្កាន់ដៃបង់ប្រាក់ - E03/E04/E05)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            receipt_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            payment_date TEXT NOT NULL,
            cashier TEXT NOT NULL DEFAULT 'admin',
            currency TEXT NOT NULL DEFAULT 'KHR',
            payment_method TEXT NOT NULL DEFAULT 'Cash',
            account_name TEXT DEFAULT 'គណនីសាច់ប្រាក់ទទួលពីអតិថិជន',
            total_amount REAL NOT NULL,
            amount_paid REAL NOT NULL,
            amount_due REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Completed',
            void_reason TEXT,
            voided_at TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE CASCADE
        );
    """)

    # 5. Payment Items Table (ភ្ជាប់បង្កាន់ដៃទៅវិក្កយបត្រ)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payment_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id TEXT NOT NULL,
            invoice_id TEXT NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (receipt_id) REFERENCES payments (receipt_id) ON DELETE CASCADE,
            FOREIGN KEY (invoice_id) REFERENCES invoices (invoice_id) ON DELETE CASCADE
        );
    """)

    conn.commit()
    conn.close()

def seed_sample_data():
    conn = get_db()
    cursor = conn.cursor()

    # Check if customers table is empty
    cursor.execute("SELECT COUNT(*) AS count FROM customers")
    if cursor.fetchone()["count"] == 0:
        # Sample Customers
        customers_data = [
            ("CUST-001", "សុខ សំណាង", "012 345 678", "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី", "MTR-1001", "2026-01-10"),
            ("CUST-002", "ចាន់ ធីតា", "098 765 432", "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី", "MTR-1002", "2026-01-15"),
            ("CUST-003", "គង់ វិបុល", "088 112 233", "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី", "MTR-1003", "2026-02-01"),
            ("CUST-004", "អ៊ុំ រតនា", "077 554 433", "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី", "MTR-1004", "2026-02-12"),
            ("CUST-005", "ម៉េង សុភា", "010 998 877", "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី", "MTR-1005", "2026-03-01"),
        ]
        cursor.executemany("""
            INSERT INTO customers (customer_id, name, phone, address, meter_number, registered_date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, customers_data)

        # Sample Meter Readings
        readings_data = [
            # ReadingID, CustomerID, MonthYear, OldReading, NewReading, TotalUnits, RecordedDate
            ("READ-202608-001", "CUST-001", "08/2026", 1200.0, 1345.0, 145.0, "2026-08-31"),
            ("READ-202609-001", "CUST-001", "09/2026", 1345.0, 1515.0, 170.0, "2026-09-05"),
            ("READ-202609-002", "CUST-002", "09/2026", 850.0, 995.0, 145.0, "2026-09-06"),
            ("READ-202609-003", "CUST-003", "09/2026", 2100.0, 2380.0, 280.0, "2026-09-07"),
            ("READ-202609-004", "CUST-004", "09/2026", 640.0, 725.0, 85.0, "2026-09-08"),
            ("READ-202609-005", "CUST-005", "09/2026", 1530.0, 1750.0, 220.0, "2026-09-09"),
        ]
        cursor.executemany("""
            INSERT INTO meter_readings (reading_id, customer_id, month_year, old_reading, new_reading, total_units, recorded_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, readings_data)

        # Sample Invoices
        # Rate: 800 Riels per kWh
        invoices_data = [
            # InvoiceID, ReadingID, RatePerUnit, TotalAmount, DueDate, Status, CreatedAt
            ("INV-2026-001", "READ-202608-001", 800.0, 145.0 * 800.0, "2026-09-15", "Paid", "2026-09-01"),
            ("INV-2026-002", "READ-202609-001", 800.0, 170.0 * 800.0, "2026-09-25", "Unpaid", "2026-09-06"),
            ("INV-2026-003", "READ-202609-002", 800.0, 145.0 * 800.0, "2026-09-25", "Paid", "2026-09-06"),
            ("INV-2026-004", "READ-202609-003", 800.0, 280.0 * 800.0, "2026-09-25", "Unpaid", "2026-09-07"),
            ("INV-2026-005", "READ-202609-004", 800.0, 85.0 * 800.0, "2026-09-25", "Paid", "2026-09-08"),
            ("INV-2026-006", "READ-202609-005", 800.0, 220.0 * 800.0, "2026-09-25", "Unpaid", "2026-09-09"),
        ]
        cursor.executemany("""
            INSERT INTO invoices (invoice_id, reading_id, rate_per_unit, total_amount, due_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, invoices_data)

        conn.commit()

    conn.close()

# ----------------- Query Helpers -----------------

def get_stats():
    conn = get_db()
    cursor = conn.cursor()

    total_customers = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    total_units_this_month = cursor.execute("""
        SELECT COALESCE(SUM(total_units), 0) FROM meter_readings 
        WHERE month_year = strftime('%m/%Y', 'now') OR month_year = '09/2026'
    """).fetchone()[0]
    
    total_revenue = cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM invoices").fetchone()[0]
    paid_revenue = cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'Paid'").fetchone()[0]
    unpaid_count = cursor.execute("SELECT COUNT(*) FROM invoices WHERE status = 'Unpaid'").fetchone()[0]
    unpaid_amount = cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'Unpaid'").fetchone()[0]
    total_invoices = cursor.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]

    conn.close()
    return {
        "total_customers": total_customers,
        "total_units_this_month": round(total_units_this_month, 2),
        "total_revenue": total_revenue,
        "paid_revenue": paid_revenue,
        "unpaid_count": unpaid_count,
        "unpaid_amount": unpaid_amount,
        "total_invoices": total_invoices
    }

def normalize_search_text(text):
    if not text:
        return ""
    km_digits = "០១២៣៤៥៦៧៨៩"
    ar_digits = "0123456789"
    trans = str.maketrans(km_digits, ar_digits)
    return text.translate(trans).strip()

def get_all_customers(search=""):
    conn = get_db()
    cursor = conn.cursor()
    if search:
        s_norm = normalize_search_text(search)
        s_like = f"%{s_norm}%"
        s_compact = s_norm.replace(" ", "").replace("-", "")
        s_compact_like = f"%{s_compact}%"
        query = """
            SELECT * FROM customers 
            WHERE customer_id LIKE ? 
               OR name LIKE ? 
               OR last_name LIKE ? 
               OR first_name LIKE ?
               OR last_name_en LIKE ? 
               OR first_name_en LIKE ? 
               OR phone LIKE ? 
               OR REPLACE(phone, ' ', '') LIKE ?
               OR meter_number LIKE ? 
               OR REPLACE(meter_number, '-', '') LIKE ?
               OR national_id LIKE ? 
               OR account_no LIKE ? 
               OR job LIKE ? 
               OR address LIKE ?
               OR village LIKE ? 
               OR commune LIKE ? 
               OR district LIKE ? 
               OR province LIKE ?
            ORDER BY customer_id DESC
        """
        params = (
            s_like, s_like, s_like, s_like,
            s_like, s_like, s_like, s_compact_like,
            s_like, s_compact_like, s_like, s_like,
            s_like, s_like, s_like, s_like,
            s_like, s_like
        )
        rows = cursor.execute(query, params).fetchall()
    else:
        rows = cursor.execute("SELECT * FROM customers ORDER BY customer_id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_customer(customer_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def create_customer(customer_id, name, phone, address, meter_number, registered_date, **kwargs):
    conn = get_db()
    query = """
        INSERT OR REPLACE INTO customers (
            customer_id, name, honorific, last_name, first_name, last_name_en, first_name_en,
            gender, dob, pob, id_type, national_id, representative, job, family_count,
            customer_type, is_poor, phone, account_no, province, district, commune,
            village, zone, house_no, street_no, address, meter_number, meter_type, photo, registered_date
        ) VALUES (
            :customer_id, :name, :honorific, :last_name, :first_name, :last_name_en, :first_name_en,
            :gender, :dob, :pob, :id_type, :national_id, :representative, :job, :family_count,
            :customer_type, :is_poor, :phone, :account_no, :province, :district, :commune,
            :village, :zone, :house_no, :street_no, :address, :meter_number, :meter_type, :photo, :registered_date
        )
    """
    params = {
        "customer_id": customer_id,
        "name": name,
        "honorific": kwargs.get("honorific", "លោក"),
        "last_name": kwargs.get("last_name", ""),
        "first_name": kwargs.get("first_name", ""),
        "last_name_en": kwargs.get("last_name_en", ""),
        "first_name_en": kwargs.get("first_name_en", ""),
        "gender": kwargs.get("gender", "ប្រុស"),
        "dob": kwargs.get("dob", ""),
        "pob": kwargs.get("pob", ""),
        "id_type": kwargs.get("id_type", "អត្តសញ្ញាណប័ណ្ណ"),
        "national_id": kwargs.get("national_id", ""),
        "representative": kwargs.get("representative", ""),
        "job": kwargs.get("job", ""),
        "family_count": int(kwargs.get("family_count", 1) or 1),
        "customer_type": kwargs.get("customer_type", "បុគ្គលមិនជាប់អាករ"),
        "is_poor": int(kwargs.get("is_poor", 0) or 0),
        "phone": phone,
        "account_no": kwargs.get("account_no", ""),
        "province": kwargs.get("province", "រតនគិរី"),
        "district": kwargs.get("district", "បានលុង"),
        "commune": kwargs.get("commune", "កាចាញ"),
        "village": kwargs.get("village", "ភូមិ ២"),
        "zone": kwargs.get("zone", "បានលុង"),
        "house_no": kwargs.get("house_no", ""),
        "street_no": kwargs.get("street_no", ""),
        "address": address,
        "meter_number": meter_number,
        "meter_type": kwargs.get("meter_type", "1-Phase (ធម្មតា 220V)"),
        "photo": kwargs.get("photo", ""),
        "registered_date": registered_date
    }
    conn.execute(query, params)
    conn.commit()
    conn.close()

def update_customer(customer_id, name, phone, address, meter_number, registered_date, **kwargs):
    conn = get_db()
    query = """
        UPDATE customers SET
            name = :name,
            honorific = :honorific,
            last_name = :last_name,
            first_name = :first_name,
            last_name_en = :last_name_en,
            first_name_en = :first_name_en,
            gender = :gender,
            dob = :dob,
            pob = :pob,
            id_type = :id_type,
            national_id = :national_id,
            representative = :representative,
            job = :job,
            family_count = :family_count,
            customer_type = :customer_type,
            is_poor = :is_poor,
            phone = :phone,
            account_no = :account_no,
            province = :province,
            district = :district,
            commune = :commune,
            village = :village,
            zone = :zone,
            house_no = :house_no,
            street_no = :street_no,
            address = :address,
            meter_number = :meter_number,
            meter_type = :meter_type,
            photo = CASE WHEN :photo != '' THEN :photo ELSE photo END,
            registered_date = :registered_date
        WHERE customer_id = :customer_id
    """
    params = {
        "customer_id": customer_id,
        "name": name,
        "honorific": kwargs.get("honorific", "លោក"),
        "last_name": kwargs.get("last_name", ""),
        "first_name": kwargs.get("first_name", ""),
        "last_name_en": kwargs.get("last_name_en", ""),
        "first_name_en": kwargs.get("first_name_en", ""),
        "gender": kwargs.get("gender", "ប្រុស"),
        "dob": kwargs.get("dob", ""),
        "pob": kwargs.get("pob", ""),
        "id_type": kwargs.get("id_type", "អត្តសញ្ញាណប័ណ្ណ"),
        "national_id": kwargs.get("national_id", ""),
        "representative": kwargs.get("representative", ""),
        "job": kwargs.get("job", ""),
        "family_count": int(kwargs.get("family_count", 1) or 1),
        "customer_type": kwargs.get("customer_type", "បុគ្គលមិនជាប់អាករ"),
        "is_poor": int(kwargs.get("is_poor", 0) or 0),
        "phone": phone,
        "account_no": kwargs.get("account_no", ""),
        "province": kwargs.get("province", "រតនគិរី"),
        "district": kwargs.get("district", "បានលុង"),
        "commune": kwargs.get("commune", "កាចាញ"),
        "village": kwargs.get("village", "ភូមិ ២"),
        "zone": kwargs.get("zone", "បានលុង"),
        "house_no": kwargs.get("house_no", ""),
        "street_no": kwargs.get("street_no", ""),
        "address": address,
        "meter_number": meter_number,
        "meter_type": kwargs.get("meter_type", "1-Phase (ធម្មតា 220V)"),
        "photo": kwargs.get("photo", ""),
        "registered_date": registered_date
    }
    conn.execute(query, params)
    conn.commit()
    conn.close()

def delete_customer(customer_id):
    conn = get_db()
    cursor = conn.cursor()
    # Delete linked invoices
    cursor.execute("""
        DELETE FROM invoices 
        WHERE reading_id IN (
            SELECT reading_id FROM meter_readings WHERE customer_id = ?
        )
    """, (customer_id,))
    # Delete meter readings
    cursor.execute("DELETE FROM meter_readings WHERE customer_id = ?", (customer_id,))
    # Delete customer record
    cursor.execute("DELETE FROM customers WHERE customer_id = ?", (customer_id,))
    conn.commit()
    conn.close()

def get_latest_reading_for_customer(customer_id):
    conn = get_db()
    row = conn.execute("""
        SELECT * FROM meter_readings 
        WHERE customer_id = ? 
        ORDER BY recorded_date DESC, reading_id DESC 
        LIMIT 1
    """, (customer_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_readings(search=""):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT r.*, c.name AS customer_name, c.meter_number, c.phone,
               i.invoice_id, i.status AS invoice_status, i.total_amount
        FROM meter_readings r
        JOIN customers c ON r.customer_id = c.customer_id
        LEFT JOIN invoices i ON r.reading_id = i.reading_id
    """
    params = []
    if search:
        s_norm = normalize_search_text(search)
        s_like = f"%{s_norm}%"
        query += """
            WHERE r.reading_id LIKE ? 
               OR r.customer_id LIKE ? 
               OR c.name LIKE ? 
               OR c.meter_number LIKE ? 
               OR c.phone LIKE ? 
               OR r.month_year LIKE ?
        """
        params.extend([s_like, s_like, s_like, s_like, s_like, s_like])
    query += " ORDER BY r.recorded_date DESC, r.reading_id DESC"
    rows = cursor.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def create_reading(reading_id, customer_id, month_year, old_reading, new_reading, recorded_date, **kwargs):
    old_val = float(old_reading)
    new_val = float(new_reading)
    meter_cycled = 1 if kwargs.get("meter_cycled") else 0
    
    if meter_cycled:
        dial_limit = 100000.0 if old_val < 100000.0 else 1000000.0
        total_units = round(new_val + dial_limit - old_val, 2)
    else:
        total_units = round(new_val - old_val, 2)

    if total_units < 0 and not meter_cycled:
        raise ValueError("លេខកុងទ័រថ្មី មិនអាចតូចជាងលេខកុងទ័រចាស់បានទេ!")

    billing_cycle = kwargs.get("billing_cycle", "")
    recorded_by = kwargs.get("recorded_by", "បុគ្គលិកស្រង់លេខ")
    usage_date_from = kwargs.get("usage_date_from", "")
    usage_date_to = kwargs.get("usage_date_to", "")

    conn = get_db()
    conn.execute("""
        INSERT INTO meter_readings (
            reading_id, customer_id, month_year, old_reading, new_reading, total_units, recorded_date,
            billing_cycle, recorded_by, usage_date_from, usage_date_to, meter_cycled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        reading_id, customer_id, month_year, old_val, new_val, total_units, recorded_date,
        billing_cycle, recorded_by, usage_date_from, usage_date_to, meter_cycled
    ))
    conn.commit()
    conn.close()
    return total_units

def get_all_invoices(status=None, search=""):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT i.*, 
               r.month_year, r.old_reading, r.new_reading, r.total_units, r.recorded_date,
               c.customer_id, c.name AS customer_name, c.phone, c.meter_number, c.address
        FROM invoices i
        JOIN meter_readings r ON i.reading_id = r.reading_id
        JOIN customers c ON r.customer_id = c.customer_id
        WHERE 1=1
    """
    params = []
    if status and status in ('Paid', 'Unpaid'):
        query += " AND i.status = ?"
        params.append(status)
    if search:
        s_norm = normalize_search_text(search)
        s_like = f"%{s_norm}%"
        query += """
            AND (i.invoice_id LIKE ? 
                 OR i.reading_id LIKE ? 
                 OR c.customer_id LIKE ? 
                 OR c.name LIKE ? 
                 OR c.meter_number LIKE ? 
                 OR c.phone LIKE ? 
                 OR r.month_year LIKE ?)
        """
        params.extend([s_like, s_like, s_like, s_like, s_like, s_like, s_like])
    query += " ORDER BY i.created_at DESC, i.invoice_id DESC"
    
    rows = cursor.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_invoice_detail(invoice_id):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT i.*, 
               r.reading_id, r.month_year, r.old_reading, r.new_reading, r.total_units, r.recorded_date,
               c.customer_id, c.name AS customer_name, c.phone, c.meter_number, c.address, c.registered_date
        FROM invoices i
        JOIN meter_readings r ON i.reading_id = r.reading_id
        JOIN customers c ON r.customer_id = c.customer_id
        WHERE i.invoice_id = ?
    """
    row = cursor.execute(query, (invoice_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def create_invoice(invoice_id, reading_id, rate_per_unit, due_date, status="Unpaid"):
    conn = get_db()
    reading = conn.execute("SELECT total_units FROM meter_readings WHERE reading_id = ?", (reading_id,)).fetchone()
    if not reading:
        conn.close()
        raise ValueError("រកមិនឃើញលេខកត់ត្រាកុងទ័រនេះទេ!")
    
    rate = float(rate_per_unit)
    total_units = float(reading["total_units"])
    total_amount = round(total_units * rate, 0)
    created_at = datetime.now().strftime("%Y-%m-%d")

    conn.execute("""
        INSERT INTO invoices (invoice_id, reading_id, rate_per_unit, total_amount, due_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (invoice_id, reading_id, rate, total_amount, due_date, status, created_at))
    conn.commit()
    conn.close()
    return total_amount

def toggle_invoice_status(invoice_id):
    conn = get_db()
    row = conn.execute("SELECT status FROM invoices WHERE invoice_id = ?", (invoice_id,)).fetchone()
    if not row:
        conn.close()
        return None
    new_status = "Paid" if row["status"] == "Unpaid" else "Unpaid"
    conn.execute("UPDATE invoices SET status = ? WHERE invoice_id = ?", (new_status, invoice_id))
    conn.commit()
    conn.close()
    return new_status

def generate_next_ids():
    conn = get_db()
    cursor = conn.cursor()

    # Next Customer ID (robust max number finding)
    cust_rows = cursor.execute("SELECT customer_id FROM customers").fetchall()
    max_cust = 0
    for r in cust_rows:
        try:
            parts = r[0].split("-")
            val = int(parts[-1])
            if val > max_cust:
                max_cust = val
        except Exception:
            pass
    next_cust_id = f"CUST-{max_cust + 1:03d}"

    # Next Reading ID
    now_ym = datetime.now().strftime("%Y%m")
    read_rows = cursor.execute("SELECT reading_id FROM meter_readings").fetchall()
    max_read = 0
    for r in read_rows:
        try:
            parts = r[0].split("-")
            val = int(parts[-1])
            if val > max_read:
                max_read = val
        except Exception:
            pass
    next_reading_id = f"READ-{now_ym}-{max_read + 1:03d}"

    # Next Invoice ID (robust max number finding)
    now_yr = datetime.now().strftime("%Y")
    inv_rows = cursor.execute("SELECT invoice_id FROM invoices WHERE invoice_id LIKE ?", (f"INV-{now_yr}-%",)).fetchall()
    max_inv = 0
    for r in inv_rows:
        try:
            parts = r[0].split("-")
            val = int(parts[-1])
            if val > max_inv:
                max_inv = val
        except Exception:
            pass
    next_invoice_id = f"INV-{now_yr}-{max_inv + 1:03d}"

    # Next Receipt ID (e.g. RCP-2026-001)
    rcp_rows = cursor.execute("SELECT receipt_id FROM payments WHERE receipt_id LIKE ?", (f"RCP-{now_yr}-%",)).fetchall()
    max_rcp = 0
    for r in rcp_rows:
        try:
            parts = r[0].split("-")
            val = int(parts[-1])
            if val > max_rcp:
                max_rcp = val
        except Exception:
            pass
    next_receipt_id = f"RCP-{now_yr}-{max_rcp + 1:03d}"

    conn.close()
    return {
        "next_customer_id": next_cust_id,
        "next_reading_id": next_reading_id,
        "next_invoice_id": next_invoice_id,
        "next_receipt_id": next_receipt_id
    }

def get_customer_unpaid_invoices(customer_id):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute("""
        SELECT i.*, r.month_year, r.old_reading, r.new_reading, r.total_units, r.recorded_date,
               c.name AS customer_name, c.meter_number, c.phone, c.zone, c.street_no, c.house_no, c.address
        FROM invoices i
        JOIN meter_readings r ON i.reading_id = r.reading_id
        JOIN customers c ON r.customer_id = c.customer_id
        WHERE i.status = 'Unpaid' AND c.customer_id = ?
        ORDER BY i.due_date ASC, i.invoice_id ASC
    """, (customer_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_unrecorded_customers(month_year=""):
    conn = get_db()
    cursor = conn.cursor()
    if not month_year:
        month_year = datetime.now().strftime("%m/%Y")
    
    m_alt = month_year.replace("-", "/") if "-" in month_year else month_year.replace("/", "-")
    
    rows = cursor.execute("""
        SELECT c.*,
               (SELECT new_reading FROM meter_readings WHERE customer_id = c.customer_id ORDER BY recorded_date DESC, reading_id DESC LIMIT 1) AS last_reading
        FROM customers c
        WHERE c.customer_id NOT IN (
            SELECT customer_id FROM meter_readings WHERE month_year = ? OR month_year = ?
        )
        ORDER BY c.customer_id ASC
    """, (month_year, m_alt)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def create_payment(customer_id, invoice_ids, amount_paid, payment_method="Cash", cashier="admin", currency="KHR", account_name="គណនីសាច់ប្រាក់ទទួលពីអតិថិជន", receipt_id=None):
    if not invoice_ids or len(invoice_ids) == 0:
        raise ValueError("សូមជ្រើសរើសវិក្កយបត្រយ៉ាងហោចណាស់មួយដើម្បីបង់ប្រាក់!")

    conn = get_db()
    cursor = conn.cursor()
    now_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    now_yr = datetime.now().strftime("%Y")

    if not receipt_id:
        rcp_rows = cursor.execute("SELECT receipt_id FROM payments WHERE receipt_id LIKE ?", (f"RCP-{now_yr}-%",)).fetchall()
        max_rcp = 0
        for r in rcp_rows:
            try:
                parts = r[0].split("-")
                val = int(parts[-1])
                if val > max_rcp:
                    max_rcp = val
            except Exception:
                pass
        receipt_id = f"RCP-{now_yr}-{max_rcp + 1:03d}"

    placeholders = ",".join(["?"] * len(invoice_ids))
    inv_rows = cursor.execute(f"SELECT invoice_id, total_amount FROM invoices WHERE invoice_id IN ({placeholders})", invoice_ids).fetchall()
    total_amount = sum(row["total_amount"] for row in inv_rows)
    amount_paid_val = float(amount_paid) if amount_paid is not None else total_amount
    amount_due = max(0.0, total_amount - amount_paid_val)

    cursor.execute("""
        INSERT INTO payments (
            receipt_id, customer_id, payment_date, cashier, currency, payment_method,
            account_name, total_amount, amount_paid, amount_due, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
    """, (
        receipt_id, customer_id, now_dt, cashier, currency, payment_method,
        account_name, total_amount, amount_paid_val, amount_due
    ))

    for inv in inv_rows:
        cursor.execute("""
            INSERT INTO payment_items (receipt_id, invoice_id, amount)
            VALUES (?, ?, ?)
        """, (receipt_id, inv["invoice_id"], inv["total_amount"]))
        cursor.execute("UPDATE invoices SET status = 'Paid' WHERE invoice_id = ?", (inv["invoice_id"],))

    conn.commit()
    conn.close()
    return {
        "receipt_id": receipt_id,
        "customer_id": customer_id,
        "payment_date": now_dt,
        "total_amount": total_amount,
        "amount_paid": amount_paid_val,
        "amount_due": amount_due,
        "invoice_count": len(invoice_ids)
    }

def get_payments(customer_id=None, month=None, search="", status=None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT p.*, c.name AS customer_name, c.meter_number, c.phone, c.zone, c.street_no, c.house_no, c.address,
               COUNT(pi.id) AS invoice_count
        FROM payments p
        JOIN customers c ON p.customer_id = c.customer_id
        LEFT JOIN payment_items pi ON p.receipt_id = pi.receipt_id
        WHERE 1=1
    """
    params = []
    if customer_id:
        query += " AND p.customer_id = ?"
        params.append(customer_id)
    if status:
        query += " AND p.status = ?"
        params.append(status)
    if month:
        m_dash = month.replace("/", "-")
        query += " AND (p.payment_date LIKE ? OR p.payment_date LIKE ?)"
        params.extend([f"%{month}%", f"%{m_dash}%"])
    if search:
        s_norm = normalize_search_text(search)
        s_like = f"%{s_norm}%"
        query += """
            AND (p.receipt_id LIKE ? 
                 OR p.customer_id LIKE ? 
                 OR c.name LIKE ? 
                 OR c.meter_number LIKE ? 
                 OR c.phone LIKE ?)
        """
        params.extend([s_like, s_like, s_like, s_like, s_like])

    query += " GROUP BY p.receipt_id ORDER BY p.payment_date DESC, p.receipt_id DESC"
    rows = cursor.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_payment_detail(receipt_id):
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("""
        SELECT p.*, c.name AS customer_name, c.meter_number, c.phone, c.zone, c.street_no, c.house_no, c.address
        FROM payments p
        JOIN customers c ON p.customer_id = c.customer_id
        WHERE p.receipt_id = ?
    """, (receipt_id,)).fetchone()
    if not row:
        conn.close()
        return None
    
    payment = dict(row)
    items = cursor.execute("""
        SELECT pi.*, i.due_date, i.total_amount, i.rate_per_unit, r.month_year, r.total_units
        FROM payment_items pi
        JOIN invoices i ON pi.invoice_id = i.invoice_id
        JOIN meter_readings r ON i.reading_id = r.reading_id
        WHERE pi.receipt_id = ?
    """, (receipt_id,)).fetchall()
    conn.close()
    payment["items"] = [dict(it) for it in items]
    return payment

def void_payment(receipt_id, reason, cashier="admin"):
    conn = get_db()
    cursor = conn.cursor()
    payment = cursor.execute("SELECT * FROM payments WHERE receipt_id = ?", (receipt_id,)).fetchone()
    if not payment:
        conn.close()
        raise ValueError("រកមិនឃើញបង្កាន់ដៃបង់ប្រាក់នេះទេ!")
    if payment["status"] == "Voided":
        conn.close()
        raise ValueError("បង្កាន់ដៃនេះត្រូវបានលុបរួចរាល់ហើយ!")

    now_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        UPDATE payments SET status = 'Voided', void_reason = ?, voided_at = ?
        WHERE receipt_id = ?
    """, (reason, now_dt, receipt_id))

    cursor.execute("""
        UPDATE invoices SET status = 'Unpaid'
        WHERE invoice_id IN (
            SELECT invoice_id FROM payment_items WHERE receipt_id = ?
        )
    """, (receipt_id,))

    conn.commit()
    conn.close()
    return {
        "success": True,
        "receipt_id": receipt_id,
        "status": "Voided",
        "voided_at": now_dt,
        "reason": reason
    }
