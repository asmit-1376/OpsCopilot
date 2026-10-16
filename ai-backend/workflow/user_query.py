"""CLI entry point for the complete streaming OpsCopilot workflow."""

from __future__ import annotations

import argparse
import asyncio
import os

from workflow.build_graph import astream_workflow


async def run() -> int:
    parser = argparse.ArgumentParser(description="Run an OpsCopilot query.")
    parser.add_argument("query", nargs="*", help="User request")
    parser.add_argument("--role", default="owner")
    parser.add_argument("--institute-id", default=os.getenv("DEMO_INSTITUTE_ID", ""))
    parser.add_argument("--trainer-id", default=os.getenv("DEMO_TRAINER_ID"))
    parser.add_argument("--student-id", default=os.getenv("DEMO_STUDENT_ID"))
    parser.add_argument("--mobile-number")
    args = parser.parse_args()
    query = " ".join(args.query).strip() or input("Enter your query: ").strip()
    if not query:
        parser.error("query cannot be empty")

    async for chunk in astream_workflow(
        query,
        role=args.role,
        institute_id=args.institute_id,
        trainer_id=args.trainer_id,
        student_id=args.student_id,
        mobile_number=args.mobile_number,
    ):
        print(chunk, end="", flush=True)
    print()
    return 0


def main() -> int:
    return asyncio.run(run())


if __name__ == "__main__":
    raise SystemExit(main())
