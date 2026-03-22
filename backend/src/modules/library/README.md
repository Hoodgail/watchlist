# Library Module

This module owns user-specific list and watch-progress behavior.

- `application/useCases/` contains list and watch-progress commands/queries.
- `infrastructure/` currently delegates to the legacy list and watch-progress services.
- `interface/http/` provides thin adapters used by the existing routes.
