# Min RSS Dashboard – webbapp

En enkel Netvibes-liknande RSS-läsare byggd med ren HTML, CSS och JavaScript.

## Funktioner
- Dashboard med RSS-widgets
- Kombinerat nyhetsflöde
- Lägg till/ta bort feeds
- Ändra antal artiklar per widget
- Flytta widgets upp/ned
- Lokal lagring i webbläsaren
- Enkel läsvy/modal
- Responsiv layout för mobil/iPad/desktop

## Starta
Öppna `index.html` i en webbläsare.

Obs: RSS-flöden hämtas via AllOrigins-proxy eftersom många RSS-källor blockerar direkt hämtning från webbläsare via CORS.
För en riktig publicerad app bör man helst ha en liten egen backend/serverless-funktion som hämtar RSS-flödena.
