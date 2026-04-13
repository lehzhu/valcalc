"""Market data providers for benchmark enrichment.

All providers fail gracefully: missing API keys, network errors, and bad
responses are logged and return empty results rather than raising.
"""
