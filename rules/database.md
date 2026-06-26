# Database Rules

## ORM
- Always use SQLAlchemy 2.x ORM (declarative style with `DeclarativeBase`)
- Never write raw SQL unless absolutely unavoidable
- Use type-annotated Column definitions with nullable/unique/index params
- Modern syntax: `id: int = Column(...)` with runtime type annotations

## Migrations
- Every schema change requires an Alembic migration
- Generate with: `alembic revision --autogenerate -m "description"`
- Run migrations from `backend/` directory
- Review auto-generated migrations before applying
- Never edit applied migrations — create a new one

## Naming Conventions
- Table names: lowercase plural (`users`, `transactions`, `categories`)
- Column names: lowercase snake_case (`hashed_password`, `transaction_type`)
- Foreign key columns: `{table}_id` (`user_id`, `category_id`)
- Relationship names: plural for `relationship()` collections, singular for references

## Models
- All models in `database/models.py`
- `Base` from `database/session.py` (uses `DeclarativeBase`)
- Use `relationship()` for all foreign key relationships
- Add `server_default=func.now()` for `created_at` timestamps
- Include `updated_at` with `onupdate=func.now()` where appropriate

## Sessions
- Use `SessionLocal()` via `get_db()` dependency from `database/session.py`
- Never manually manage sessions in routers
- Always use FastAPI dependency injection for session lifecycle

## Alembic
- Config in `database/alembic.ini`
- Migration scripts in `database/alembic/versions/`
- `env.py` reads `DATABASE_URL` from settings at runtime
