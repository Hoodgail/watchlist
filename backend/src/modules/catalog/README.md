# Catalog Module

This module owns provider-facing catalog concerns such as search, source lookup, alias linking, and provider mappings.

- `application/useCases/` contains catalog queries and commands.
- `infrastructure/` currently delegates to the legacy media/provider services.
- `interface/http/` provides thin adapters used by the existing media and provider-mapping routes.
