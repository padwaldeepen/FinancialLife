"""The money type for API schemas.

`rules/database.md` is absolute that money is `Numeric(12,2)` in Postgres and `Decimal`
in Python, never `float` — because binary floating point cannot represent 0.10 and the
error compounds across a sum. But a JSON payload has no decimal type, and every existing
endpoint already puts money on the wire as a JSON number (`"amount": 33.25`), which the
frontend reads as `number`.

`Money` reconciles those: `Decimal` everywhere inside Python — validation, arithmetic,
storage — with exactly one conversion, at the JSON serialization boundary. That is not
"doing money maths in float": a double represents any 2-decimal amount exactly well past
any balance this app will hold, and no arithmetic happens after the conversion.

Use it for every money field in a request or response model, so there is one answer to
"what type is an amount" instead of a per-file judgement call.
"""

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# when_used="json" keeps `model_dump()` returning a real Decimal for internal callers;
# only `model_dump_json()` / the HTTP response converts.
Money = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]
