import csv
import io
from datetime import date, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from database.models import Profile
from database.session import get_db
from routers.auth import get_current_profile

router = APIRouter()


@router.get("/csv")
async def export_csv(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    profile: Profile = Depends(get_current_profile),
    conn: asyncpg.Connection = Depends(get_db),
):
    conditions = ["t.profile_id = $1"]
    params: list = [profile.id]

    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            params.append(dt_from)
            conditions.append(f"t.date >= ${len(params)}")
        except ValueError:
            pass
    else:
        params.append(datetime.now() - timedelta(days=365))
        conditions.append(f"t.date >= ${len(params)}")

    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            params.append(dt_to)
            conditions.append(f"t.date < ${len(params)}")
        except ValueError:
            pass

    rows = await conn.fetch(
        f"""SELECT t.date, t.description, t.amount, t.transaction_type, t.notes,
                   c.name AS category_name, m.name AS merchant_name, a.name AS account_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN merchants m ON m.id = t.merchant_id
            LEFT JOIN accounts a ON a.id = t.account_id
            WHERE {" AND ".join(conditions)}
            ORDER BY t.date DESC""",
        *params,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Date", "Description", "Amount", "Type", "Category", "Merchant", "Account", "Notes"]
    )

    for row in rows:
        writer.writerow(
            [
                row["date"].strftime("%Y-%m-%d"),
                row["description"],
                f"{float(row['amount']):.2f}",
                row["transaction_type"],
                row["category_name"] or "",
                row["merchant_name"] or "",
                row["account_name"] or "",
                row["notes"] or "",
            ]
        )

    output.seek(0)
    today = date.today().strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=my-financial-life-{today}.csv"},
    )
