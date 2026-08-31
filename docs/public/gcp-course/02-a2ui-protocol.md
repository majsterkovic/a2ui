# Moduł 2: Interfejs A2UI (Agent-to-User Interface)

Gdy autonomiczny agent wchodzi w interakcję z człowiekiem, standardowy tekst lub surowy format Markdown szybko okazują się niewystarczające. Użytkownik potrzebuje interaktywnych formularzy, tabel danych, przycisków akcji, kalendarzy czy wykresów, a agent musi natychmiast otrzymać informację zwrotną o wprowadzonych zmianach.

**A2UI (Agent-to-User Interface)** to lekki, bezpieczny i zorientowany na strumieniowanie protokół deklaratywnego interfejsu użytkownika, zaprojektowany specjalnie dla modeli językowych i agentów AI.

---

## Dlaczego Markdown i surowy HTML to za mało?

W tradycyjnych aplikacjach czatowych z LLM pojawiają się trzy główne ograniczenia:
1. **Brak interaktywności i dwukierunkowego stanu:** Markdown pozwala jedynie wyświetlać statyczny tekst i tabele. Nie można w nim zaimplementować formularza z walidacją po stronie klienta.
2. **Ryzyko bezpieczeństwa surowego kodu HTML/JS:** Generowanie surowego kodu JavaScript przez model niesie ryzyko podatności XSS (*Cross-Site Scripting*) i trudności w kontrolowaniu stylów.
3. **Opóźnienia strumieniowania:** Czekanie na wygenerowanie kompletnego kodu strony blokuje interfejs użytkownika.

A2UI rozwiązuje te problemy, przesyłając **deklaratywne struktury JSON**, które renderer klienta (np. w Lit, React, Angular czy Flutterze) natychmiast przekształca w natywne komponenty UI.

---

## Architektura i Przepływ Danych w A2UI

Protokół A2UI opiera się na ciągłej pętli synchronizacji stanu:

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 Użytkownik
    participant R as 📱 Renderer A2UI
    participant A as 🤖 Agent (Cloud Run)

    U->>R: Wpisuje polecenie
    R->>A: Przesyła żądanie (REST/SSE)
    A-->>R: Strumieniuje komponenty A2UI JSON
    R->>U: Renderuje interaktywny formularz
    U->>R: Wypełnia formularz i klika przycisk
    R->>A: Wysyła zdarzenie akcji ze stanem
    A-->>R: Odsyła zaktualizowany widok
```

---

## Główne filary protokołu A2UI

### 1. Komunikaty strumieniowe (Streaming Messages)
Agent przesyła dane jako sekwencję komunikatów JSON, z których każdy pełni określoną rolę:

* `createSurface` — tworzy nową powierzchnię UI (ang. *surface*) i wskazuje katalog komponentów.
* `updateComponents` — dodaje lub aktualizuje drzewo komponentów na powierzchni.
* `updateDataModel` — ustawia lub zmienia wartości w modelu danych.
* `deleteSurface` — zamyka i usuwa powierzchnię.

### 2. Spłaszczona lista komponentów (Component Adjacency List)
Zamiast głęboko zagnieżdżonego drzewa JSON (które jest trudne do strumieniowania i parsowania przez LLM w czasie rzeczywistym), A2UI stosuje **płaską tablicę komponentów**. Każdy komponent posiada unikalne `id` oraz odwołuje się do swoich dzieci za pomocą identyfikatorów (`child` lub `children`).

### 3. Dwukierunkowe wiązanie danych (Two-Way Data Binding)
Stan formularza nie jest zakodowany na stałe w komponentach. Komponenty wskazują na ścieżki w modelu danych za pomocą standardu **JSON Pointer** (np. `{"path": "/booking/date"}` lub `{"path": "/customer/email"}`). 
Gdy użytkownik wpisuje tekst w pole, model danych w kliencie aktualizuje się automatycznie.

### 4. Katalogi komponentów (Component Catalogs)
Renderer posiada zdefiniowany katalog znanych komponentów (np. `Text`, `Button`, `TextField`, `Card`, `Table`, `Select`). Agent nie przesyła kodu implementacji komponentu, a jedynie nazwę z katalogu i parametry. Zapobiega to wstrzykiwaniu złośliwego kodu do przeglądarki.

### 5. Zdarzenia i akcje (`action`)
Gdy użytkownik kliknie przycisk, renderer nie przeładowuje strony, lecz generuje komunikat `action` (*Client-to-Server*) i przesyła go do agenta wraz z kontekstem zdarzenia.

---

## Przykładowy ładunek A2UI v0.9.1 (JSON)

W specyfikacji A2UI v0.9.1 agent przesyła dane w formie **sekwencji komunikatów strumieniowych**, a nie jednego monolitycznego obiektu. Poniżej pokazujemy trzy komunikaty, które razem tworzą prosty formularz kontaktowy:

**Krok 1 — Utworzenie powierzchni i drzewa komponentów:**

```json
{
  "version": "v0.9.1",
  "createSurface": {
    "surfaceId": "contact_form_1",
    "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
  }
}
```

```json
{
  "version": "v0.9.1",
  "updateComponents": {
    "surfaceId": "contact_form_1",
    "components": [
      {
        "id": "root",
        "component": "Card",
        "child": "form_column"
      },
      {
        "id": "form_column",
        "component": "Column",
        "children": ["form_title", "input_name", "input_email", "btn_submit"]
      },
      {
        "id": "form_title",
        "component": "Text",
        "text": "Formularz zgłoszeniowy",
        "variant": "h2"
      },
      {
        "id": "input_name",
        "component": "TextField",
        "label": "Imię i nazwisko",
        "value": { "path": "/contact/name" }
      },
      {
        "id": "input_email",
        "component": "TextField",
        "label": "Adres e-mail",
        "value": { "path": "/contact/email" }
      },
      {
        "id": "btn_label",
        "component": "Text",
        "text": "Wyślij zgłoszenie"
      },
      {
        "id": "btn_submit",
        "component": "Button",
        "child": "btn_label",
        "variant": "primary",
        "action": {
          "event": {
            "name": "submit_contact_form",
            "context": {
              "contact_data": { "path": "/contact" }
            }
          }
        }
      }
    ]
  }
}
```

**Krok 2 — Inicjalizacja modelu danych:**

```json
{
  "version": "v0.9.1",
  "updateDataModel": {
    "surfaceId": "contact_form_1",
    "path": "/contact",
    "value": {
      "name": "Jan Kowalski",
      "email": "",
      "topic": "Wsparcie techniczne"
    }
  }
}
```

### Co dzieje się po kliknięciu przycisku?
Po kliknięciu przycisku `Wyślij zgłoszenie`, renderer A2UI generuje komunikat akcji (*Client-to-Server*) zgodny ze schematem specyfikacji:

```json
{
  "version": "v0.9.1",
  "action": {
    "name": "submit_contact_form",
    "surfaceId": "contact_form_1",
    "sourceComponentId": "btn_submit",
    "timestamp": "2026-08-31T22:00:00Z",
    "context": {
      "contact_data": {
        "name": "Jan Kowalski",
        "email": "jan.kowalski@example.com",
        "topic": "Wsparcie techniczne"
      }
    }
  }
}
```

---

## Porównanie podejść do generowania UI przez Agentów

| Cecha | Surowy HTML / JS | Standardowy Markdown | Protokół A2UI |
| :--- | :--- | :--- | :--- |
| **Bezpieczeństwo (XSS)** | Niskie (ryzyko wstrzyknięcia skryptu) | Wysokie | Wysokie (bezpieczny renderer katalogowy) |
| **Interaktywność (Formularze)** | Wymaga kodu JS po stronie agenta | Brak (tylko statyczny odczyt) | Pełna (dwukierunkowy data-binding) |
| **Strumieniowanie** | Trudne parsowanie częściowego HTML | Płynne dla tekstu | Płynne strumieniowanie obiektów JSON |
| **Spójność wizualna (Design System)** | Trudna do wymuszenia na modelu | Bardzo ograniczona | Automatyczna (katalog komponentów klienta) |

---

## Podsumowanie

A2UI pozwala rozdzielić **logikę podejmowania decyzji przez agenta** od **warstwy wizualnej klienta**:
* Agent decyduje *co* pokazać i *jakie dane* powiązać.
* Klient (aplikacja webowa lub mobilna) decyduje *jak* to wyrenderować zgodnie z design systemem firmy.

W kolejnym module dowiesz się, jak zasilać agentów modelami korporacyjnymi. Przejdź do [Modułu 3: Gemini Enterprise & Vertex AI](03-gemini-enterprise.md).
