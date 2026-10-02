"""Read only: never save the workbook or open it with write access."""
import sys, json, datetime, hashlib, io
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')
with open(sys.argv[1], 'rb') as source:
    raw = source.read()
book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
sheet = book['Follow Up']
def value(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime('%Y-%m-%d')
    return '' if v is None else str(v).strip()
rows = [[value(v) for v in row] for row in sheet.iter_rows(min_row=5, max_col=12, values_only=True)]
book.close()
print(json.dumps({'sha256': hashlib.sha256(raw).hexdigest(), 'rows': rows}, ensure_ascii=False))
