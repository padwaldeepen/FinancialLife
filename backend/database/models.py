from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.session import Base


class User(Base):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String, unique=True, index=True, nullable=False)
    username: str = Column(String, unique=True, index=True, nullable=False)
    hashed_password: str = Column(String, nullable=False)
    full_name: str | None = Column(String)
    is_active: bool = Column(Boolean, default=True)
    created_at: datetime = Column(DateTime, server_default=func.now())
    updated_at: datetime | None = Column(DateTime, onupdate=func.now())

    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    categories = relationship("Category", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String, nullable=False)
    color: str = Column(String, default="#6B7280")
    icon: str | None = Column(String)
    user_id: int | None = Column(Integer, ForeignKey("users.id"))
    created_at: datetime = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id: int = Column(Integer, primary_key=True, index=True)
    amount: float = Column(Float, nullable=False)
    description: str = Column(String, nullable=False)
    transaction_type: str = Column(String, nullable=False)
    category_id: int | None = Column(Integer, ForeignKey("categories.id"))
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    date: datetime = Column(DateTime, nullable=False)
    notes: str | None = Column(Text)
    ai_categorized: bool = Column(Boolean, default=False)
    created_at: datetime = Column(DateTime, server_default=func.now())
    updated_at: datetime | None = Column(DateTime, onupdate=func.now())

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String, nullable=False)
    amount: float = Column(Float, nullable=False)
    period: str = Column(String, nullable=False)
    category_id: int | None = Column(Integer, ForeignKey("categories.id"))
    user_id: int = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date: datetime = Column(DateTime, nullable=False)
    end_date: datetime | None = Column(DateTime)
    is_active: bool = Column(Boolean, default=True)
    created_at: datetime = Column(DateTime, server_default=func.now())
    updated_at: datetime | None = Column(DateTime, onupdate=func.now())

    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")
