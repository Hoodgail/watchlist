# Library Module

This module owns user-specific list and watch-progress behavior.

- `application/useCases/` contains list and watch-progress commands/queries.
- `infrastructure/` uses Prisma for list ownership, progress, and canonical identity resolution.
- `interface/http/` provides thin adapters used by the existing routes.
