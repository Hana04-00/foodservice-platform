"""Payment gateway abstraction.

The app ships with a *simulated* Razorpay-style gateway: it invents a
transaction id, waits a short artificial moment, and reports success. No real
money moves and no API keys are involved.

To go live later, implement `PaymentGateway` with the real Razorpay SDK
(create order -> client-side checkout -> verify signature webhook) and swap the
`get_gateway()` return value. Nothing else in the app needs to change: routers
depend only on this interface.
"""
from __future__ import annotations

import random
import string
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol


@dataclass
class PaymentResult:
    ok: bool
    txn_id: str
    method: str
    amount: float
    paid_at: datetime
    message: str = "Payment successful (demo — no real money moved)."


class PaymentGateway(Protocol):
    name: str

    def charge(self, *, amount: float, method: str, reference: str) -> PaymentResult: ...


class SimulatedRazorpayGateway:
    """Stand-in for Razorpay. Deterministic-ish, always succeeds for demo."""

    name = "simulated-razorpay"

    def __init__(self, latency_seconds: float = 0.6) -> None:
        self._latency = latency_seconds

    def _txn_id(self) -> str:
        body = "".join(random.choices(string.ascii_lowercase + string.digits, k=14))
        return f"pay_demo_{body}"

    def charge(self, *, amount: float, method: str, reference: str) -> PaymentResult:
        if method not in {"upi", "card", "netbanking"}:
            return PaymentResult(
                ok=False,
                txn_id="",
                method=method,
                amount=amount,
                paid_at=datetime.now(timezone.utc),
                message=f"Unsupported payment method: {method!r}",
            )
        # Artificial gateway round-trip delay so the UI can show a spinner.
        time.sleep(self._latency)
        return PaymentResult(
            ok=True,
            txn_id=self._txn_id(),
            method=method,
            amount=round(float(amount), 2),
            paid_at=datetime.now(timezone.utc),
        )


_gateway: PaymentGateway = SimulatedRazorpayGateway()


def get_gateway() -> PaymentGateway:
    return _gateway


def set_gateway(gateway: PaymentGateway) -> None:
    """Test seam / future real-Razorpay swap point."""
    global _gateway
    _gateway = gateway
