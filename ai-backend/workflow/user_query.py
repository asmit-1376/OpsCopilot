"""CLI entry point for testing a user query through the Jev intent router."""

from __future__ import annotations

import argparse
import json

from decision import JevError, route_query


def main() -> int:
    parser = argparse.ArgumentParser(description="Route an OpsCopilot query through Jev.")
    parser.add_argument("query", nargs="*", help="The user's natural-language question")
    args = parser.parse_args()
    query = " ".join(args.query).strip() or input("Enter your query: ").strip()

    try:
        result = route_query(query)
    except (JevError, ValueError) as exc:
        parser.exit(1, f"Routing failed: {exc}\n")

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
