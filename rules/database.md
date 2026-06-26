# Database Rules

## ORM
- Always use SQLAlchemy 2.x ORM (declarative style)
- Never write raw SQL unless absolutely unavoidable
- Use type-annotated Column definitions with nullable/unique/index params

## Migrations
- Every schema change requires an Alembic migration
- Generate migrations with: `alembic revision --autogenerate -m "description"`
- Review auto-generated migrations before applying
- Never edit existing migrations — create a new one

## Naming Conventions
- Table names: lowercase plural (`users`, `transactions`, `categories`)
- Column names: lowercase snake_case (`hashed_password`, `transaction_type`)
- Foreign key columns: `{table}_id` (`user_id`, `category_id`)
- Relationship names: plural for collections, singular for references

## Models
- Models in `database/models.py` only
- Use `relationship()` for all foreign key relationships
- Add `server_default=func.now()` for created_at timestamps
- Include `updated_at` with `onupdate=func.now()` where appropriate

## Sessions
- Use `SessionLocal()` via dependency injection
- Never manually manage sessions in routers
- Always use context manager or dependency for session lifecycle
