"""Type hints only — NOT database-mapped. No ORM anywhere in this project (see
rules/database.md). Each dataclass is a typed bag of the columns for one row, built
manually from an asyncpg Record after a raw SQL query: `Account(**dict(row))`.
Related data (e.g. a transaction's category name) comes from an explicit JOIN in the
query, never from touching an attribute — there is no lazy loading."""

from dataclasses import dataclass
from datetime import datetime

# Country -> currency is fixed at profile creation (architecture-and-goals.md
# "Country & currency rules"). One profile = one currency, always, forever.
COUNTRY_CURRENCY: dict[str, str] = {"US": "USD", "IN": "INR", "CA": "CAD"}


@dataclass
class User:
    id: int
    email: str
    username: str
    hashed_password: str
    full_name: str | None
    is_admin: bool
    is_active: bool
    ai_cloud_enabled: bool
    created_at: datetime
    updated_at: datetime | None = None


@dataclass
class Profile:
    id: int
    user_id: int
    country: str
    currency: str
    created_at: datetime


@dataclass
class Category:
    id: int
    name: str
    color: str
    icon: str | None
    user_id: int | None
    is_system: bool
    parent_id: int | None
    created_at: datetime


@dataclass
class Merchant:
    id: int
    profile_id: int
    name: str
    normalized_name: str
    aliases: list[str] | None
    is_hidden: bool
    created_at: datetime


@dataclass
class Account:
    id: int
    profile_id: int
    name: str
    type: str
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime | None = None


@dataclass
class Transaction:
    id: int
    amount: float
    description: str
    transaction_type: str
    account_id: int
    profile_id: int
    category_id: int | None = None
    merchant_id: int | None = None
    bill_id: int | None = None
    goal_id: int | None = None
    is_pending: bool = False
    is_recurring: bool = False
    date: datetime | None = None
    notes: str | None = None
    ai_categorized: bool = False
    source: str = "manual"
    import_hash: str | None = None
    document_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Budget:
    id: int
    name: str
    amount: float
    period: str
    profile_id: int
    start_date: datetime
    category_id: int | None = None
    end_date: datetime | None = None
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Bill:
    id: int
    profile_id: int
    name: str
    amount: float
    frequency: str
    due_day: int
    account_id: int
    amount_estimated: float | None = None
    category_id: int | None = None
    merchant_id: int | None = None
    is_active: bool = True
    is_variable: bool = False
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class TransactionBillLink:
    id: int
    transaction_id: int
    bill_id: int
    period_start: datetime
    period_end: datetime
    is_auto_linked: bool
    created_at: datetime


@dataclass
class Goal:
    id: int
    profile_id: int
    name: str
    target_amount: float
    type: str
    current_amount: float = 0.0
    monthly_contribution: float | None = None
    category_id: int | None = None
    deadline: datetime | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Document:
    id: int
    profile_id: int
    kind: str
    file_path: str
    mime_type: str
    status: str
    extracted_json: dict | None
    uploaded_at: datetime
