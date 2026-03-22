# Identity Module

This module is the first backend vertical slice for the refactor.

- `application/useCases/` contains identity-specific commands and queries.
- `application/ports/` defines the dependencies the use cases rely on.
- `infrastructure/` currently adapts the legacy auth/OAuth services while preserving behavior.
- `interface/http/` contains the thin HTTP adapters used by the auth routes.
- New identity work should land here instead of adding more controller-to-service coupling.
