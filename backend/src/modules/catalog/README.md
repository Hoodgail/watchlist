# Catalog Module

This module owns provider-facing catalog concerns such as search, source lookup, alias linking, and provider mappings.

- `application/useCases/` contains catalog queries and commands.
- `infrastructure/` uses provider adapters for lookups and Prisma for canonical identities and per-user mappings.
- `interface/http/` provides thin adapters used by the existing media and provider-mapping routes.
