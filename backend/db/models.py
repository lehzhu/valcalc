import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, Integer, Date, DateTime, JSON, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    stage: Mapped[str] = mapped_column(String(50))
    sector: Mapped[str] = mapped_column(String(100))
    revenue_status: Mapped[str] = mapped_column(String(50))
    current_revenue: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_round_valuation: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_amount: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    last_round_investor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    projections: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    auditor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    valuations: Mapped[list["Valuation"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class Valuation(Base):
    __tablename__ = "valuations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("companies.id"))
    version: Mapped[int] = mapped_column(Integer)
    primary_method: Mapped[str] = mapped_column(String(50))
    fair_value: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    fair_value_low: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    fair_value_high: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    explanation: Mapped[str] = mapped_column(Text)
    method_results: Mapped[dict] = mapped_column(JSON)
    audit_trail: Mapped[dict] = mapped_column(JSON)
    overrides: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    company: Mapped["Company"] = relationship(back_populates="valuations")
