"""Tests for hash_service: date normalization and hash generation."""
import pytest
from datetime import date

from app.integrations.azure_devops.hash_service import (
    compute_date_hash,
    normalize_date,
    normalize_devops_date,
)


class TestNormalizeDate:
    def test_none_returns_none(self):
        assert normalize_date(None) is None

    def test_date_object(self):
        assert normalize_date(date(2026, 5, 1)) == "2026-05-01"

    def test_string_full(self):
        assert normalize_date("2026-05-01") == "2026-05-01"

    def test_string_with_time(self):
        # Only the YYYY-MM-DD part is used
        assert normalize_date("2026-05-01T12:34:56") == "2026-05-01"

    def test_empty_string_returns_none(self):
        assert normalize_date("") is None

    def test_whitespace_string_returns_none(self):
        assert normalize_date("   ") is None


class TestNormalizeDevopsDate:
    def test_none(self):
        assert normalize_devops_date(None) is None

    def test_empty(self):
        assert normalize_devops_date("") is None

    def test_utc_datetime(self):
        assert normalize_devops_date("2026-05-01T00:00:00Z") == "2026-05-01"

    def test_date_only(self):
        assert normalize_devops_date("2026-05-10") == "2026-05-10"


class TestComputeDateHash:
    def test_identical_inputs_produce_same_hash(self):
        h1 = compute_date_hash(date(2026, 5, 1), date(2026, 5, 10), None, None)
        h2 = compute_date_hash(date(2026, 5, 1), date(2026, 5, 10), None, None)
        assert h1 == h2

    def test_different_inputs_produce_different_hash(self):
        h1 = compute_date_hash(date(2026, 5, 1), date(2026, 5, 10), None, None)
        h2 = compute_date_hash(date(2026, 5, 2), date(2026, 5, 10), None, None)
        assert h1 != h2

    def test_all_none(self):
        h = compute_date_hash(None, None, None, None)
        assert len(h) == 64  # SHA-256 hex digest

    def test_string_and_date_object_equal(self):
        h1 = compute_date_hash("2026-05-01", "2026-05-10", None, None)
        h2 = compute_date_hash(date(2026, 5, 1), date(2026, 5, 10), None, None)
        assert h1 == h2

    def test_key_order_is_fixed(self):
        # Swapping argument order must change the hash
        h1 = compute_date_hash(date(2026, 5, 1), date(2026, 5, 10), None, None)
        h2 = compute_date_hash(date(2026, 5, 10), date(2026, 5, 1), None, None)
        assert h1 != h2

    def test_returns_hex_string(self):
        h = compute_date_hash(date(2026, 1, 1), date(2026, 1, 31), None, None)
        assert all(c in "0123456789abcdef" for c in h)
