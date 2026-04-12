from typing import Protocol
from datetime import date
from valuation_engine.models import CompanyInput, MethodResult

class ValuationMethod(Protocol):
    def compute(self, company: CompanyInput, valuation_date: date) -> MethodResult:
        ...
