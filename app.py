import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from flask import Flask, render_template, request, jsonify, redirect, url_for
import database
from datetime import datetime

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

# Template custom filters
@app.template_filter('currency_khr')
def currency_khr(val):
    try:
        return f"{int(round(float(val))):,} ៛"
    except (ValueError, TypeError):
        return "0 ៛"

@app.template_filter('currency_usd')
def currency_usd(val, rate=4000):
    try:
        usd = float(val) / rate
        return f"${usd:,.2f}"
    except (ValueError, TypeError):
        return "$0.00"

@app.template_filter('number_fmt')
def number_fmt(val):
    try:
        f = float(val)
        return f"{f:,.2f}".rstrip('0').rstrip('.') if '.' in f"{f:,.2f}" else f"{int(f):,}"
    except (ValueError, TypeError):
        return "0"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/invoice/<invoice_id>")
def view_invoice(invoice_id):
    invoice = database.get_invoice_detail(invoice_id)
    if not invoice:
        return render_template("error.html", message=f"រកមិនឃើញវិក្កយបត្រលេខ {invoice_id} ទេ!"), 404
    return render_template("invoice.html", inv=invoice)

# ----------------- API Endpoints -----------------

@app.route("/api/stats")
def api_stats():
    stats = database.get_stats()
    return jsonify({"success": True, "data": stats})

@app.route("/api/next-ids")
def api_next_ids():
    ids = database.generate_next_ids()
    return jsonify({"success": True, "data": ids})

@app.route("/api/customers", methods=["GET", "POST"])
def api_customers():
    if request.method == "POST":
        data = request.json or request.form
        customer_id = data.get("customer_id", "").strip()
        name = data.get("name", "").strip()
        phone = data.get("phone", "").strip()
        address = data.get("address", "").strip()
        meter_number = data.get("meter_number", "").strip()
        registered_date = data.get("registered_date", "").strip() or datetime.now().strftime("%Y-%m-%d")

        if not name or not meter_number:
            return jsonify({"success": False, "error": "សូមបញ្ចូលឈ្មោះអតិថិជន និងលេខកុងទ័រ!"}), 400

        if not customer_id:
            customer_id = database.generate_next_ids()["next_customer_id"]

        try:
            database.create_customer(
                customer_id=customer_id,
                name=name,
                phone=phone,
                address=address,
                meter_number=meter_number,
                registered_date=registered_date,
                honorific=data.get("honorific", "លោក"),
                last_name=data.get("last_name", ""),
                first_name=data.get("first_name", ""),
                last_name_en=data.get("last_name_en", ""),
                first_name_en=data.get("first_name_en", ""),
                gender=data.get("gender", "ប្រុស"),
                dob=data.get("dob", ""),
                pob=data.get("pob", ""),
                id_type=data.get("id_type", "អត្តសញ្ញាណប័ណ្ណ"),
                national_id=data.get("national_id", ""),
                representative=data.get("representative", ""),
                job=data.get("job", ""),
                family_count=data.get("family_count", 1),
                customer_type=data.get("customer_type", "បុគ្គលមិនជាប់អាករ"),
                is_poor=data.get("is_poor", 0),
                account_no=data.get("account_no", ""),
                province=data.get("province", "រតនគិរី"),
                district=data.get("district", "បានលុង"),
                commune=data.get("commune", "កាចាញ"),
                village=data.get("village", "ភូមិ ២"),
                zone=data.get("zone", "បានលុង"),
                house_no=data.get("house_no", ""),
                street_no=data.get("street_no", ""),
                meter_type=data.get("meter_type", "1-Phase (ធម្មតា 220V)"),
                photo=data.get("photo", "")
            )
            return jsonify({"success": True, "message": "បានរក្សាទុកទិន្នន័យអតិថិជនជោគជ័យ!", "customer_id": customer_id})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    search = request.args.get("search", "")
    customers = database.get_all_customers(search)
    return jsonify({"success": True, "data": customers})

@app.route("/api/customers/<customer_id>", methods=["GET", "PUT", "POST", "DELETE"])
def api_customer_detail(customer_id):
    if request.method == "DELETE":
        customer = database.get_customer(customer_id)
        if not customer:
            return jsonify({"success": False, "error": "រកមិនឃើញអតិថិជននេះទេ"}), 404
        try:
            database.delete_customer(customer_id)
            return jsonify({"success": True, "message": f"បានលុបអតិថិជន {customer['name']} ({customer_id}) ជោគជ័យ!"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    elif request.method in ("PUT", "POST"):
        data = request.json or request.form
        name = data.get("name", "").strip()
        meter_number = data.get("meter_number", "").strip()
        phone = data.get("phone", "").strip()
        address = data.get("address", "").strip()
        registered_date = data.get("registered_date", "").strip() or datetime.now().strftime("%Y-%m-%d")

        if not name or not meter_number:
            return jsonify({"success": False, "error": "សូមបញ្ចូលឈ្មោះអតិថិជន និងលេខកុងទ័រ!"}), 400

        try:
            database.update_customer(
                customer_id=customer_id,
                name=name,
                phone=phone,
                address=address,
                meter_number=meter_number,
                registered_date=registered_date,
                honorific=data.get("honorific", "លោក"),
                last_name=data.get("last_name", ""),
                first_name=data.get("first_name", ""),
                last_name_en=data.get("last_name_en", ""),
                first_name_en=data.get("first_name_en", ""),
                gender=data.get("gender", "ប្រុស"),
                dob=data.get("dob", ""),
                pob=data.get("pob", ""),
                id_type=data.get("id_type", "អត្តសញ្ញាណប័ណ្ណ"),
                national_id=data.get("national_id", ""),
                representative=data.get("representative", ""),
                job=data.get("job", ""),
                family_count=data.get("family_count", 1),
                customer_type=data.get("customer_type", "បុគ្គលមិនជាប់អាករ"),
                is_poor=data.get("is_poor", 0),
                account_no=data.get("account_no", ""),
                province=data.get("province", "រតនគិរី"),
                district=data.get("district", "បានលុង"),
                commune=data.get("commune", "កាចាញ"),
                village=data.get("village", "ភូមិ ២"),
                zone=data.get("zone", "បានលុង"),
                house_no=data.get("house_no", ""),
                street_no=data.get("street_no", ""),
                meter_type=data.get("meter_type", "1-Phase (ធម្មតា 220V)"),
                photo=data.get("photo", "")
            )
            return jsonify({"success": True, "message": "បានកែប្រែទិន្នន័យអតិថិជនជោគជ័យ!", "customer_id": customer_id})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    # GET
    customer = database.get_customer(customer_id)
    if not customer:
        return jsonify({"success": False, "error": "រកមិនឃើញអតិថិជននេះទេ"}), 404
    return jsonify({"success": True, "data": customer})

@app.route("/api/customers/<customer_id>/latest-reading")
def api_customer_latest_reading(customer_id):
    customer = database.get_customer(customer_id)
    if not customer:
        return jsonify({"success": False, "error": "រកមិនឃើញអតិថិជននេះទេ"}), 404
    
    latest = database.get_latest_reading_for_customer(customer_id)
    return jsonify({
        "success": True,
        "customer": customer,
        "latest_reading": latest,
        "suggested_old_reading": latest["new_reading"] if latest else 0.0
    })

@app.route("/api/readings", methods=["GET", "POST"])
def api_readings():
    if request.method == "POST":
        data = request.json or request.form
        reading_id = data.get("reading_id", "").strip()
        customer_id = data.get("customer_id", "").strip()
        month_year = data.get("month_year", "").strip()
        old_reading = data.get("old_reading")
        new_reading = data.get("new_reading")
        recorded_date = data.get("recorded_date", "").strip() or datetime.now().strftime("%Y-%m-%d")
        auto_generate_invoice = data.get("auto_generate_invoice", True)

        if not customer_id or old_reading is None or new_reading is None:
            return jsonify({"success": False, "error": "សូមបំពេញទិន្នន័យឱ្យបានគ្រប់គ្រាន់!"}), 400

        if not reading_id:
            reading_id = database.generate_next_ids()["next_reading_id"]

        try:
            total_units = database.create_reading(
                reading_id, customer_id, month_year, old_reading, new_reading, recorded_date,
                billing_cycle=data.get("billing_cycle", ""),
                recorded_by=data.get("recorded_by", "បុគ្គលិកស្រង់លេខ"),
                usage_date_from=data.get("usage_date_from", ""),
                usage_date_to=data.get("usage_date_to", ""),
                meter_cycled=data.get("meter_cycled", 0)
            )

            invoice_id = None
            if auto_generate_invoice:
                next_inv = database.generate_next_ids()["next_invoice_id"]
                rate = float(data.get("rate_per_unit", 800))
                due_date = data.get("due_date", datetime.now().strftime("%Y-%m-25"))
                database.create_invoice(next_inv, reading_id, rate, due_date, status="Unpaid")
                invoice_id = next_inv

            return jsonify({
                "success": True, 
                "message": "បានកត់ត្រាកុងទ័រជោគជ័យ!",
                "reading_id": reading_id,
                "total_units": total_units,
                "invoice_id": invoice_id
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    search = request.args.get("search", "")
    readings = database.get_all_readings(search)
    return jsonify({"success": True, "data": readings})

@app.route("/api/customers/<customer_id>/unpaid-invoices")
def api_customer_unpaid_invoices(customer_id):
    invoices = database.get_customer_unpaid_invoices(customer_id)
    return jsonify({"success": True, "data": invoices, "invoices": invoices})

@app.route("/api/customers/unrecorded")
def api_unrecorded_customers():
    month = request.args.get("month", "")
    customers = database.get_unrecorded_customers(month)
    return jsonify({"success": True, "data": customers, "total": len(customers)})

@app.route("/api/payments", methods=["GET", "POST"])
def api_payments():
    if request.method == "POST":
        data = request.json or request.form
        customer_id = data.get("customer_id", "").strip()
        invoice_ids = data.get("invoice_ids", [])
        if isinstance(invoice_ids, str):
            invoice_ids = [x.strip() for x in invoice_ids.split(",") if x.strip()]
        
        amount_paid = data.get("amount_paid")
        payment_method = data.get("payment_method", "Cash")
        cashier = data.get("cashier", "admin")
        currency = data.get("currency", "KHR")
        account_name = data.get("account_name", "គណនីសាច់ប្រាក់ទទួលពីអតិថិជន")
        receipt_id = data.get("receipt_id", "").strip() or None

        if not customer_id:
            return jsonify({"success": False, "error": "សូមជ្រើសរើសអតិថិជន!"}), 400
        if not invoice_ids or len(invoice_ids) == 0:
            return jsonify({"success": False, "error": "សូមជ្រើសរើសវិក្កយបត្រយ៉ាងហោចណាស់មួយ!"}), 400

        try:
            res = database.create_payment(
                customer_id=customer_id,
                invoice_ids=invoice_ids,
                amount_paid=amount_paid,
                payment_method=payment_method,
                cashier=cashier,
                currency=currency,
                account_name=account_name,
                receipt_id=receipt_id
            )
            return jsonify({
                "success": True, 
                "message": "បានទូទាត់ប្រាក់ជោគជ័យ!", 
                "data": res,
                "receipt_id": res["receipt_id"],
                "amount_paid": res["amount_paid"]
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    customer_id = request.args.get("customer_id")
    month = request.args.get("month")
    search = request.args.get("search", "")
    status = request.args.get("status")
    payments = database.get_payments(customer_id, month, search, status)
    return jsonify({"success": True, "data": payments})

@app.route("/api/payments/<receipt_id>")
def api_payment_detail(receipt_id):
    payment = database.get_payment_detail(receipt_id)
    if not payment:
        return jsonify({"success": False, "error": "រកមិនឃើញបង្កាន់ដៃនេះទេ"}), 404
    return jsonify({"success": True, "data": payment, "payment": payment})

@app.route("/api/payments/<receipt_id>/void", methods=["POST"])
def api_void_payment(receipt_id):
    data = request.json or request.form
    reason = data.get("reason", "").strip()
    if not reason:
        return jsonify({"success": False, "error": "សូមបញ្ជាក់ពីមូលហេតុនៃការលុបការបង់ប្រាក់!"}), 400
    
    cashier = data.get("cashier", "admin")
    try:
        res = database.void_payment(receipt_id, reason, cashier)
        return jsonify({"success": True, "message": f"បានលុបការបង់ប្រាក់ {receipt_id} ជោគជ័យ និងបានកំណត់វិក្កយបត្រទៅជា 'មិនទាន់បង់' វិញ!", "data": res})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/receipt/<receipt_id>")
def view_receipt_page(receipt_id):
    payment = database.get_payment_detail(receipt_id)
    if not payment:
        return "រកមិនឃើញបង្កាន់ដៃនេះទេ", 404
    return render_template("receipt.html", payment=payment, items=payment.get("items", []))

@app.route("/api/invoices", methods=["GET", "POST"])
def api_invoices():
    if request.method == "POST":
        data = request.json or request.form
        invoice_id = data.get("invoice_id", "").strip()
        reading_id = data.get("reading_id", "").strip()
        rate_per_unit = data.get("rate_per_unit", 800)
        due_date = data.get("due_date", "").strip()
        status = data.get("status", "Unpaid").strip()

        if not reading_id:
            return jsonify({"success": False, "error": "សូមជ្រើសរើសលេខកត់ត្រាកុងទ័រ!"}), 400

        if not invoice_id:
            invoice_id = database.generate_next_ids()["next_invoice_id"]

        try:
            total_amount = database.create_invoice(invoice_id, reading_id, rate_per_unit, due_date, status)
            return jsonify({
                "success": True, 
                "message": "បានបង្កើតវិក្កយបត្រជោគជ័យ!",
                "invoice_id": invoice_id,
                "total_amount": total_amount
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    status = request.args.get("status")
    search = request.args.get("search", "")
    invoices = database.get_all_invoices(status, search)
    return jsonify({"success": True, "data": invoices})

@app.route("/api/invoices/<invoice_id>/toggle-status", methods=["POST"])
def api_toggle_invoice(invoice_id):
    new_status = database.toggle_invoice_status(invoice_id)
    if not new_status:
        return jsonify({"success": False, "error": "រកមិនឃើញវិក្កយបត្រនេះទេ"}), 404
    return jsonify({"success": True, "new_status": new_status})

if __name__ == "__main__":
    import sys
    import threading
    import webbrowser
    import time

    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
            sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    except Exception:
        pass

    database.init_db()
    database.seed_sample_data()

    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open("http://127.0.0.1:5050")
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()

    print("[SERVER RUNNING] E-PowerRTK running on http://127.0.0.1:5050", flush=True)
    app.run(host="0.0.0.0", port=5050, debug=False, use_reloader=False)
