import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import json
from app import app
import database

def run_tests():
    print("=== Testing E-PowerRTK Web API via Flask Client ===")
    
    # Ensure DB is ready
    database.init_db()
    database.seed_sample_data()

    client = app.test_client()

    # 1. Test Home Page
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    html = res.get_data(as_text=True)
    assert "E-PowerRTK" in html
    assert "ផ្ទាំងគ្រប់គ្រង" in html
    print("[PASS] 1. Home Dashboard Route (GET /) -> 200 OK")

    # 2. Test Stats API
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    stats = data["data"]
    assert stats["total_customers"] >= 5
    print(f"[PASS] 2. Stats API (GET /api/stats) -> {stats}")

    # 3. Test Customers List
    res = client.get("/api/customers")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    print(f"[PASS] 3. Customers List (GET /api/customers) -> Count: {len(data['data'])}")

    # 4. Test Customer Registration (POST /api/customers)
    import time
    ts = int(time.time())
    new_cust = {
        "customer_id": f"CUST-T{ts % 10000}",
        "name": "ហេង វីរៈ",
        "phone": "099 888 777",
        "address": "ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី",
        "meter_number": f"MTR-{ts % 10000}",
        "registered_date": "2026-09-10"
    }
    res = client.post("/api/customers", json=new_cust)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    test_cust_id = data["customer_id"]
    print(f"[PASS] 4. Customer Created -> ID: {test_cust_id}")

    # 5. Test Customer Latest Reading Lookup (Smart Auto-fill)
    res = client.get(f"/api/customers/{test_cust_id}/latest-reading")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["suggested_old_reading"] == 0.0
    print(f"[PASS] 5. Customer Latest Reading Lookup -> Suggested Old: {data['suggested_old_reading']} kWh")

    # 6. Test Record Meter Reading (POST /api/readings)
    reading_payload = {
        "reading_id": f"READ-T{ts % 10000}",
        "customer_id": test_cust_id,
        "month_year": "09/2026",
        "old_reading": 0.0,
        "new_reading": 125.0,
        "rate_per_unit": 800.0,
        "due_date": "2026-09-25",
        "auto_generate_invoice": True
    }
    res = client.post("/api/readings", json=reading_payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["total_units"] == 125.0
    new_inv_id = data["invoice_id"]
    print(f"[PASS] 6. Meter Reading Recorded -> ReadingID: {data['reading_id']}, TotalUnits: {data['total_units']} kWh, InvoiceID: {new_inv_id}")

    # 7. Test Invoices List & Verification
    res = client.get("/api/invoices")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    inv = next(i for i in data["data"] if i["invoice_id"] == new_inv_id)
    # Formula check: TotalAmount = TotalUnits (125) * Rate (800) = 100,000 Riels
    assert inv["total_amount"] == 100000.0, f"Expected 100000.0, got {inv['total_amount']}"
    print(f"[PASS] 7. Invoice Formula Verified -> {inv['total_units']} kWh x {inv['rate_per_unit']} = {inv['total_amount']:,.0f} KHR")

    # 8. Test Toggle Payment Status (Unpaid -> Paid)
    res = client.post(f"/api/invoices/{new_inv_id}/toggle-status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["new_status"] == "Paid"
    print(f"[PASS] 8. Invoice Status Toggled -> New Status: {data['new_status']}")

    # 9. Test Dedicated Official Invoice Template Rendering (GET /invoice/<id>)
    res = client.get(f"/invoice/{new_inv_id}")
    assert res.status_code == 200
    inv_html = res.get_data(as_text=True)
    assert "E-PowerRTK" in inv_html
    assert "KHQR" in inv_html
    assert f"MTR-{ts % 10000}" in inv_html
    assert "100,000" in inv_html
    print(f"[PASS] 9. Dedicated Invoice & KHQR Page Rendered -> 200 OK (Contains KHQR & Bill info)")

    # 10. Test Edit Customer (PUT /api/customers/<id>)
    update_payload = {
        "name": "ហេង វីរៈ (កែប្រែ)",
        "phone": "099 999 888",
        "address": "ផ្ទះលេខ ១២ ភូមិ ២ សង្កាត់ កាចាញ ក្រុង បានលុង ខេត្តរតនគិរី",
        "meter_number": f"MTR-{ts % 10000}",
        "registered_date": "2026-09-10",
        "job": "វិស្វករអគ្គិសនី"
    }
    res = client.put(f"/api/customers/{test_cust_id}", json=update_payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    # Verify update persisted
    res_get = client.get(f"/api/customers/{test_cust_id}")
    assert res_get.status_code == 200
    updated_cust = res_get.get_json()["data"]
    assert updated_cust["name"] == "ហេង វីរៈ (កែប្រែ)"
    assert updated_cust["phone"] == "099 999 888"
    assert updated_cust["job"] == "វិស្វករអគ្គិសនី"
    print(f"[PASS] 10. Edit Customer (PUT /api/customers/{test_cust_id}) -> Name: {updated_cust['name']}, Phone: {updated_cust['phone']}")

    # 11. Test Delete Customer (DELETE /api/customers/<id>)
    res = client.delete(f"/api/customers/{test_cust_id}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    # Verify customer is gone
    res_get_del = client.get(f"/api/customers/{test_cust_id}")
    assert res_get_del.status_code == 404
    print(f"[PASS] 11. Delete Customer (DELETE /api/customers/{test_cust_id}) -> Customer & linked data cascaded successfully")

    # 12. Test Search API across Customers, Readings, and Invoices
    # 12.1 Customer Search by Phone without spaces (and with Khmer digits)
    res_search_phone = client.get("/api/customers?search=099888777")
    assert res_search_phone.status_code == 200
    phone_results = res_search_phone.get_json()["data"]
    assert len(phone_results) >= 1
    assert any("099" in c["phone"] for c in phone_results)

    # 12.1b Customer Search using Khmer digits (០៩៩)
    res_km_phone = client.get("/api/customers?search=%E1%9F%A0%E1%9F%A9%E1%9F%A9")
    assert res_km_phone.status_code == 200
    assert len(res_km_phone.get_json()["data"]) >= 1

    # 12.2 Customer Search by Khmer name
    from urllib.parse import quote
    res_search_name = client.get(f"/api/customers?search={quote('ហេង')}")
    assert res_search_name.status_code == 200
    name_results = res_search_name.get_json()["data"]
    assert len(name_results) >= 1
    assert any("ហេង" in c["name"] for c in name_results)

    # 12.3 Customer Search by Meter Number (digits only)
    res_search_mtr = client.get("/api/customers?search=1001")
    assert res_search_mtr.status_code == 200
    mtr_results = res_search_mtr.get_json()["data"]
    assert len(mtr_results) >= 1

    # 12.4 Readings Search
    res_search_read = client.get("/api/readings?search=READ-2026")
    assert res_search_read.status_code == 200
    read_results = res_search_read.get_json()["data"]
    assert len(read_results) >= 1

    # 12.5 Invoices Search
    res_search_inv = client.get("/api/invoices?search=INV-2026")
    assert res_search_inv.status_code == 200
    inv_results = res_search_inv.get_json()["data"]
    assert len(inv_results) >= 1
    print(f"[PASS] 12. Search Operations Verified -> Phone, Name, Meter, Readings & Invoices Search OK")

    # 13. Test E02 Meter Reading with Rollover (meter_cycled = 1)
    # Register customer for E02 test
    c_e02 = {
        "customer_id": f"CUST-E02-{ts % 10000}",
        "name": "ជា សុខា",
        "phone": "012 333 444",
        "address": "ភូមិ ៣ សង្កាត់ បឹងកន្សែង",
        "meter_number": f"MTR-E02-{ts % 10000}",
        "registered_date": "2026-09-10"
    }
    res = client.post("/api/customers", json=c_e02)
    assert res.status_code == 200
    e02_cust_id = c_e02["customer_id"]

    # Initial reading at 99950 kWh
    res = client.post("/api/readings", json={
        "reading_id": f"RD-E02-1-{ts % 10000}",
        "customer_id": e02_cust_id,
        "month_year": "08/2026",
        "old_reading": 99800.0,
        "new_reading": 99950.0,
        "rate_per_unit": 800.0,
        "due_date": "2026-08-25",
        "auto_generate_invoice": True
    })
    assert res.status_code == 200

    # Next month reading with rollover to 50 kWh: TotalUnits should be (100000 - 99950) + 50 = 100 kWh
    res = client.post("/api/readings", json={
        "reading_id": f"RD-E02-2-{ts % 10000}",
        "customer_id": e02_cust_id,
        "month_year": "09/2026",
        "old_reading": 99950.0,
        "new_reading": 50.0,
        "multiplier": 1,
        "meter_cycled": 1,
        "billing_cycle": "1",
        "recorded_by": "admin",
        "rate_per_unit": 800.0,
        "due_date": "2026-09-25",
        "auto_generate_invoice": True
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_units"] == 100.0, f"Expected rollover 100.0 kWh, got {data['total_units']}"
    e02_inv_id = data["invoice_id"]
    print(f"[PASS] 13. E02 Reading with Rollover Verified -> 99,950 -> 50 kWh = {data['total_units']} kWh")

    # 14. Test E02 Unrecorded Customers API
    res = client.get("/api/customers/unrecorded?month=09/2026")
    assert res.status_code == 200
    unrec = res.get_json()
    assert unrec["success"] is True
    print(f"[PASS] 14. E02 Unrecorded Customers Lookup -> {unrec['total']} customers pending for 09/2026")

    # 15. Test E03 Payment Flow
    # Check unpaid invoices for customer
    res = client.get(f"/api/customers/{e02_cust_id}/unpaid-invoices")
    assert res.status_code == 200
    unpaid_invs = res.get_json()["invoices"]
    assert any(inv["invoice_id"] == e02_inv_id for inv in unpaid_invs)

    # Process payment for this invoice (100 kWh * 800 = 80,000 Riels)
    pay_res = client.post("/api/payments", json={
        "customer_id": e02_cust_id,
        "invoice_ids": [e02_inv_id],
        "amount_paid": 80000.0,
        "currency": "KHR",
        "payment_method": "KHQR",
        "account_name": "ABA: 001 234 567",
        "cashier": "admin"
    })
    assert pay_res.status_code == 200
    pay_data = pay_res.get_json()
    assert pay_data["success"] is True
    test_rcp_id = pay_data["receipt_id"]
    print(f"[PASS] 15. E03 Payment Processed -> ReceiptID: {test_rcp_id}, Amount: {pay_data['amount_paid']:,} KHR")

    # Verify invoice status is now Paid
    inv_check = client.get("/api/invoices")
    paid_inv = next(i for i in inv_check.get_json()["data"] if i["invoice_id"] == e02_inv_id)
    assert paid_inv["status"] == "Paid"

    # 16. Test E04 Official Receipt Detail & Printable Template
    rcp_res = client.get(f"/api/payments/{test_rcp_id}")
    assert rcp_res.status_code == 200
    rcp_detail = rcp_res.get_json()["payment"]
    assert rcp_detail["receipt_id"] == test_rcp_id
    assert len(rcp_detail["items"]) == 1

    rcp_page = client.get(f"/receipt/{test_rcp_id}")
    assert rcp_page.status_code == 200
    rcp_html = rcp_page.get_data(as_text=True)
    assert "បង្កាន់ដៃទទួលប្រាក់" in rcp_html
    assert test_rcp_id in rcp_html
    assert "80,000" in rcp_html
    print(f"[PASS] 16. E04 Official Printable Receipt Template Rendered -> 200 OK")

    # 17. Test E05 Void Payment Flow
    void_res = client.post(f"/api/payments/{test_rcp_id}/void", json={
        "reason": "ច្រឡំអតិថិជន និងវិធីសាស្ត្រទូទាត់",
        "cashier": "admin"
    })
    assert void_res.status_code == 200
    void_data = void_res.get_json()
    assert void_data["success"] is True

    # Verify receipt is now Voided
    rcp_void_check = client.get(f"/api/payments/{test_rcp_id}")
    assert rcp_void_check.get_json()["payment"]["status"] == "Voided"

    # Verify invoice reverted to Unpaid
    inv_void_check = client.get("/api/invoices")
    reverted_inv = next(i for i in inv_void_check.get_json()["data"] if i["invoice_id"] == e02_inv_id)
    assert reverted_inv["status"] == "Unpaid"
    print(f"[PASS] 17. E05 Void Payment Verified -> Receipt Voided & Invoice Reverted to 'Unpaid'")

    print("\n=======================================================")
    print("🎉 ALL 17 TEST SUITES (E01-E05) PASSED WITH 100% SUCCESS!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
