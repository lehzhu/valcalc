import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from db.session import Base, get_db
from api.main import app

# IMPORTANT: port 5433, not 5432!
TEST_DATABASE_URL = "postgresql://vc_audit:vc_audit_dev@localhost:5433/vc_audit_test"

# Create the test database if it doesn't exist
_admin_engine = create_engine("postgresql://vc_audit:vc_audit_dev@localhost:5433/vc_audit", isolation_level="AUTOCOMMIT")
with _admin_engine.connect() as conn:
    exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = 'vc_audit_test'")).fetchone()
    if not exists:
        conn.execute(text("CREATE DATABASE vc_audit_test"))
_admin_engine.dispose()

test_engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session(setup_db):
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(setup_db):
    def override_get_db():
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
