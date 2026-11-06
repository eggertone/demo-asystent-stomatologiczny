# Asystent informacyjny (demo)

Demo asystenta informacyjnego w formie czatu: czysty HTML, CSS i JS, bez frameworków i bundlera.

## Uruchomienie lokalne

W folderze projektu:

```bash
python -m http.server 8000
```

Potem otwórz w przeglądarce http://localhost:8000

## Tryb testowy

Pod adresem http://localhost:8000/?mock=1 strona nie łączy się z webhookiem, tylko zwraca
przykładowe odpowiedzi z fikcyjnymi danymi.

## Konfiguracja

Wartości `WEBHOOK_URL` i `SEKRET` wpisz na samej górze pliku `script.js`.
