# Incrementum-Benutzerhandbuch

**Ihr vollständiger Leitfaden zur Beherrschung des inkrementellen Lesens und der räumlichen Wiederholung**

---

## Einführung

### Was ist Inkrementum?

Incrementum ist eine leistungsstarke Lernanwendung, die zwei bewährte Techniken kombiniert:

**Inkrementelles Lesen** – Verarbeiten Sie große Informationsmengen im Laufe der Zeit in kleinen, überschaubaren Blöcken. Anstatt Artikel von Anfang bis Ende zu lesen, extrahieren Sie wichtige Punkte und bauen nach und nach Verständnis auf.

**Abgeteilte Wiederholungen** – Überprüfen Sie das Material in wissenschaftlich optimierten Abständen, um die Erinnerung zu maximieren. Algorithmen wie FSRS-6 und SM-18 sagen voraus, wann Sie etwas vergessen werden und planen Überprüfungen rechtzeitig ein.

### Schlüsselkonzepte

- **Dokumente**: Quellmaterialien (PDFs, EPUBs, Artikel, Videos)
- **Auszüge**: Wichtige Punkte oder Abschnitte, die Sie aus Dokumenten extrahiert haben
- **Lernelemente**: Aus Auszügen erstellte Lernkarten oder Frage-und-Antwort-Karten
- **Warteschlange**: Zur Überprüfung geplante Elemente, sortiert nach Priorität
- **Bewertungen**: Sitzungen, in denen Sie Ihr Wissen aktiv abrufen und bewerten

---

## Erste Schritte

### Erster Start

Wenn Sie Incrementum zum ersten Mal starten, sehen Sie das **Dashboard** mit vier Hauptabschnitten:

1. **Warteschlange** – Ihre Bewertungswarteschlange (zunächst leer)
2. **Überprüfung** – Aktive Überprüfungssitzung
3. **Dokumente** – Ihre Dokumentenbibliothek
4. **Analysen** – Fortschrittsstatistiken

### Ersteinrichtung

1. **Wählen Sie ein Design** – Navigieren Sie zu Einstellungen → Erscheinungsbild → Design
   - 147 integrierte Themes verfügbar (26 moderne, 121 Legacy)
   - Probieren Sie „Modern Dark“ oder „Material You“ für einen modernen Look

2. **Überprüfungseinstellungen konfigurieren** – Einstellungen → Lernen → Algorithmus
   - **Algorithmus**: FSRS-6 (empfohlen), SM-18 oder SM-2
   - **Gewünschte Erinnerung**: 90 % (Standard) – legt fest, wie gut Sie sich erinnern möchten
   - **Lernen pro Tag**: 20–50 Elemente empfohlen für Anfänger

3. **Kategorien einrichten** – Einstellungen → Kategorien
   - Erstellen Sie Kategorien für verschiedene Themen (z. B. „Programmierung“, „Wissenschaft“, „Sprachen“)
   - Mithilfe von Kategorien können Sie Ihre Lernmaterialien organisieren und filtern

### Ihr erstes Dokument

Lassen Sie uns Ihr erstes Dokument importieren:

1. Klicken Sie in der Seitenleiste auf **Dokumente**
2. Klicken Sie auf die Schaltfläche **Importieren** (oben rechts).
3. Wählen Sie Ihre Importmethode:
   - **Lokale Datei**: Wählen Sie eine PDF-, EPUB- oder Textdatei aus
   - **URL**: Fügen Sie eine beliebige Web-URL ein
   - **Arxiv**: Fügen Sie eine ID oder URL einer Forschungsarbeit ein
4. Warten Sie auf die Bearbeitung
   - Wenn die automatische Segmentierung in den Einstellungen aktiviert ist, wird das Dokument nach dem Import automatisch in Auszüge aufgeteilt

---

## Dokumentenmanagement

### Formate importieren

| Formatieren | Beschreibung | Anwendungsfall |
|--------|-------------|----------|
| **PDF** | Tragbares Dokumentformat | Forschungsarbeiten, E-Books, Dokumentation |
| **EPUB** | Elektronische Veröffentlichung | Bücher, Artikel mit umfließendem Text |
| **Abschlag** | „.md“-Dateien | Technische Dokumentation, Hinweise |
| **HTML** | Webseiten | Artikel, Blogbeiträge |
| **Anki (.apkg)** | Anki-Deck-Paket | Von Anki migrieren |
| **SuperMemo** | ZIP-Exporte | Von SuperMemo migrieren |
| **JSON (.json)** | Flashcard-Deck-Dateien | Decks mit Planungsdaten importieren |
| **URL** | Beliebiger Weblink | Online-Artikel, Blogs |
| **Arxiv** | Wissenschaftliche Arbeiten | Forschungsliteratur |
| **Screenshot** | Screenshot | Schnelle Aufnahmen aus jeder App |

### Dokumente importieren

#### Methode 1: Lokale Dateien

1. Klicken Sie auf **Dokumente** → **Importieren**
2. Wählen Sie **Lokale Datei**
3. Navigieren Sie zu Ihrer Datei und wählen Sie sie aus
4. Inkrementum wird:
   - Textinhalt extrahieren
   - Berechnen Sie die Lesezeit und die Wortzahl
   - Metadaten extrahieren (Titel, Autor usw.)
   - Wenn die automatische Segmentierung aktiviert ist (Einstellungen → Dokumente → Beim Import automatisch verarbeiten), wird das Dokument automatisch in Auszüge aufgeteilt

#### Methode 2: URL-Import

1. Kopieren Sie eine beliebige Web-URL
2. Klicken Sie auf **Dokumente** → **Importieren** → **URL**
3. Fügen Sie die URL ein
4. Klicken Sie auf **Importieren**
5. Incrementum ruft den Inhalt ab und verarbeitet ihn

**Unterstützte Websites:**
- Nachrichtenartikel (die meisten großen Websites)
- Blogbeiträge
- Dokumentationsseiten
- Medium, Substack usw.

#### Methode 3: Arxiv-Papiere

1. Finden Sie einen Arxiv-Artikel (z. B. „https://arxiv.org/abs/2301.07041“)
2. Kopieren Sie die URL oder Papier-ID („2301.07041“).
3. Klicken Sie auf **Dokumente** → **Importieren** → **Arxiv**
4. Fügen Sie die URL oder ID ein
5. Inkrementelle Downloads:
   - Vollständiges PDF
   - Zusammenfassung
   - Autoren
   - Veröffentlichungsdatum
   - Referenzen

#### Methode 4: JSON-Deck-Import

Importieren Sie Karteikartenstapel aus JSON-Dateien, die Planungsdaten (Intervalle, Leichtigkeitsfaktoren, Überprüfungsverlauf) enthalten.

**Importieren über die Dateiauswahl:**

1. Klicken Sie auf **Dokumente** → **Importieren** → **JSON**
2. Wählen Sie Ihre „.json“-Deck-Datei aus
3. Incrementum erstellt ein Deckdokument und importiert alle Karten, wobei Folgendes erhalten bleibt:
   - Terminplanung (Intervalle, Erleichterungsfaktoren, Fälligkeitstermine)
   - Überprüfungsverlauf (Wiederholungen, Ausfälle, Aufbewahrungsrate)
   - Kartenstatus (neu, überprüft oder gesperrt)

**Importieren per Drag and Drop:**

Ziehen Sie eine „.json“-Datei direkt in das App-Fenster. Wenn die Datei dem erwarteten Deckformat entspricht, wird sie automatisch importiert.

**JSON-Deckformat:**

Die Datei sollte ein flaches Objekt sein, das den Fragetext den Kartendaten zuordnet:

„json
{
  „Was ist das Kraftwerk der Zelle?“: {
    „Antwort“: „Die Mitochondrien.“,
    „Fachgebiet“: „Biologie“,
    „deck_name“: „Zellbiologie“,
    „ease_factor“: 2,6,
    „interval_days“: 7,
    „Wiederholungen“: 3,
    „due_at“: „2026-04-20T12:00:00Z“
  }
}
„

**Hinweise:**
- Jede „.json“-Datei erstellt ein Deck. Der Deckname stammt aus dem Feld „deck_name“.
- Importierte Karten verwenden standardmäßig den SM-2-Algorithmus. Sie können den Algorithmus nach dem Import wechseln.
- Wenn Sie dieselbe Datei zweimal löschen, entstehen keine Duplikate – vorhandene Karten werden übersprungen.
- Karten mit der Markierung „known_pile: true“ werden als gesperrt importiert.

### Dokumentbetrachter

Öffnen Sie nach dem Import ein beliebiges Dokument, um darauf zuzugreifen:

**Viewer-Funktionen:**
- **Seitennavigation**: Scrollen Sie durch Seiten/Abschnitte
- **Zoom**: Textgröße anpassen
- **Vollbild**: Ablenkungsfreies Lesen
- **Suchen**: Text im Dokument suchen
- **Inhaltsverzeichnis**: Zu Abschnitten springen (falls verfügbar)**Anmerkungstools:**
1. **Text hervorheben**: Text auswählen → Hervorhebungsfarbe auswählen
   - Gelb: Wichtige Konzepte
   - Grün: Beispiele
   - Blau: Definitionen
   - Rot: Kritische Punkte
   - Lila: Verwandte Themen

2. **Extrakt erstellen**: Text auswählen → Klicken Sie auf die Schaltfläche „Extrahieren“.
   - Der Extrakt wird auf der Registerkarte „Extrakte“ angezeigt
   - Kann später in eine Karteikarte umgewandelt werden

3. **Notiz hinzufügen**: Text auswählen → Klicken Sie auf die Schaltfläche „Notiz“.
   - Hängen Sie Ihre Gedanken/Notizen an
   - Notizen erscheinen mit Auszügen

### Dokumentenorganisation

**Kategorien:**
- Ordnen Sie jedes Dokument einer Kategorie zu
- Filtern Sie Dokumente nach Kategorie
- Kategorien werden an Extrakte und Karten vererbt

**Tags:**
- Fügen Sie benutzerdefinierte Tags zu Dokumenten hinzu
- Verwenden Sie Tags für die kategorieübergreifende Organisation
- Beispiele: „#dringend“, „#Forschung“, „#Tutorial“.

**Suche:**
- Volltextsuche in allen Dokumenten
- Filtern Sie nach Kategorie, Tags und Datumsbereich
- Sortieren Sie nach Titel, Datum und Wortanzahl

---

## Das lernende System

### FSRS-6 verstehen

**FSRS-6** (Free Spaced Repetition Scheduler) ist ein moderner Algorithmus, der:

1. **Verfolgt den Speicherstatus**: Modelliert Ihre Speicherstärke für jede Karte
2. **Prognostiziert das Vergessen**: Schätzt ein, wann Sie jedes Element vergessen werden
3. **Optimiert die Planung**: Plant Überprüfungen zu optimalen Zeiten
4. **Passt sich an Sie an**: Lernt aus Ihren Leistungsmustern

**Wichtige Kennzahlen:**
- **Stabilität**: Wie lange ein Speicher hält (höher = stabiler)
- **Schwierigkeit**: Wie schwer der Gegenstand für Sie ist (Skala 1-10)
- **Retrieverability**: Aktuelle Wahrscheinlichkeit des Rückrufs (0-100 %)

### Bewertungssystem

Bewerten Sie bei Rezensionen jeden Artikel basierend auf Ihrer Erinnerung:

| Bewertung | Etikett | Beschreibung | Typisches Intervall |
|--------|-------|-------------|------------------|
| **1** | Wieder | Kompletter Blackout | ~10 Minuten |
| **2** | Hart | Mit großem Aufwand in Erinnerung geblieben | 1-2 Tage |
| **3** | Gut | Mit einigem Nachdenken erinnert | 5-7 Tage |
| **4** | Einfach | Der Rückruf war mühelos | 10-14 Tage |

**Vorschauintervalle:**
Vor der Bewertung zeigt Ihnen Incrementum für alle vier Bewertungsoptionen genau an, wann jede Karte als nächstes erscheint. Nutzen Sie dies, um Ihren Zeitplan zu optimieren!

### Kartentypen

#### 1. Grundlegende Karteikarten
Einfache Vorder-/Rückseitenkarten

**Vorderseite:** Was ist die Hauptstadt von Frankreich?
**Rückseite:** Paris

**Am besten geeignet für:** Fakten, Definitionen, Vokabeln

#### 2. Lückentext löschen
Stil zum Ausfüllen der Lücken

**Text:** Die Hauptstadt von {{Frankreich}} ist Paris.

**Wird angezeigt als:** Die Hauptstadt von _____ ist Paris.

**Am besten geeignet für:** Kontextuelles Lernen, Beziehungen

#### 3. Frage-und-Antwort-Karten
Frage- und Antwortpaare

**F:** Erklären Sie den Unterschied zwischen TCP und UDP.
**A:** TCP ist verbindungsorientiert mit garantierter Zustellung; UDP ist verbindungslos und ohne Garantien.

**Am besten geeignet für:** Konzepte, Erklärungen

#### 4. Bildverdeckung
Teile eines Bildes ausblenden (Diagramme, Diagramme)

**Am besten geeignet für:** Anatomie, Karten, Diagramme

### Karten erstellen

#### Aus Auszügen

1. Wählen Sie beim Lesen wichtigen Text aus
2. Klicken Sie auf **Extrahieren**, um einen Extrakt zu erstellen
3. Überprüfen Sie auf der Registerkarte **Extrakte** Ihre Extrakte
4. Klicken Sie in einem beliebigen Auszug auf **Karte erstellen**
5. Wählen Sie den Kartentyp (Lernkarte, Lückentext, Fragen und Antworten).
6. Bearbeiten Sie den Karteninhalt
7. Klicken Sie auf **Speichern**

Die Karte ist jetzt zur Überprüfung vorgesehen!

#### Manuelle Erstellung

1. Klicken Sie auf **Warteschlange** → **Element hinzufügen**
2. Wählen Sie den Kartentyp
3. Geben Sie den Inhalt für die Vorder-/Rückseite ein
4. Kategorie auswählen
5. Klicken Sie auf **Erstellen**

#### KI-gestützte Generation

Wenn Sie AI konfiguriert haben:

1. Wählen Sie einen Auszug oder Dokumentabschnitt aus
2. Klicken Sie auf **Karten generieren**
3. Die KI erstellt automatisch mehrere Karten
4. Überprüfen und bearbeiten Sie sie nach Bedarf
5. Speichern Sie die besten

---

## Deckmanager

Der **Deck Manager** ist eine Vollbildansicht zum Durchsuchen, Überprüfen und Bearbeiten Ihrer Lernkartendecks und ihrer Karten. Öffnen Sie es über die Schaltfläche **Deck Manager** auf der Review-Startseite.

### Decks durchsuchen

- Die linke Seitenleiste listet alle Ihre Decks mit Kartenanzahl und Fälligkeitsindikatoren auf.
- Klicken Sie auf ein Deck, um es zu erweitern – es wird jeweils nur ein Deck erweitert.
- Tag-Filter für jedes Deck werden als kleine Pillen unter dem Decknamen angezeigt.

### Kartenliste

Wenn ein Deck erweitert wird, erscheinen seine Karten in einer virtualisierten, scrollbaren Liste. Jede Kartenreihe zeigt:

- **Staatsabzeichen** – farblich gekennzeichnet: Blau (Neu), Orange (Lernen), Grün (Rezension), Rot (Neulernen)
- **Fragenvorschau** – bis zu 80 Zeichen
- **Fälligkeitsdatum** – relative Bezeichnung (Heute, Morgen, 5 Tage, überfällig)
- **Schwierigkeit** – 1–10 Mini-Fortschrittsbalken
- **Intervall** – aktuelles Überprüfungsintervall in Tagen
- **Bewertungsanzahl** – wie oft die Karte überprüft wurde
- **Leech-Anzeige** – gelbes Warnsymbol für Karten mit mehr als 5 Fehlern

### Sortieren und Filtern

**Sortieren** Sie Karten nach Fälligkeitsdatum, Status, Schwierigkeitsgrad, Intervall, Überprüfungsanzahl oder Versäumnissen. Klicken Sie erneut auf eine Sortierschaltfläche, um zwischen aufsteigend und absteigend umzuschalten.

**Filtern** nach:
- **Status** – Neu, Lernen, Überprüfen, Neulernen
- **Fälligkeitsstatus** – Heute fällig, überfällig, nicht fällig

**Suchen** Sie mithilfe der Suchleiste oben nach Fragetext oder Tag-Namen.

### Inline-Karteneditor

Klicken Sie auf eine beliebige Kartenzeile, um einen Inline-Editor darunter zu erweitern:

- Bearbeiten Sie **Frage**, **Antwort** und **Tags** direkt – kein Modal erforderlich.
- **Lückenkarten** zeigen den Lückentext mit hervorgehobenen Löschbereichen an.
- **Komplexe Kartentypen** (Multiple-Choice, Bildverdeckung) zeigen eine schreibgeschützte Vorschau mit einem Link „In Studio bearbeiten“.
- Umschalten zwischen **Suspend/Suspendierung aufheben** mit einem einzigen Klick.
– Änderungen werden mit **optimistischen Updates** gespeichert – die Benutzeroberfläche wird sofort aktualisiert und wird zurückgesetzt, wenn das Speichern fehlschlägt.

### Deck-Statistik-Panel

Die rechte Seitenleiste zeigt Statistiken für das erweiterte Deck:

- **Heute fällig** – Anzahl der Karten, die jetzt fällig sind
- **Retentionsrate** – geschätzt basierend auf der Stornoquote
- **Durchschnittlicher Schwierigkeitsgrad** – für alle Karten im Stapel
- **Blutegelanzahl** – Karten mit mehr als 5 Fehlern (klicken Sie, um nur nach Blutegeln zu filtern)
- **Aufschlüsselung nach Reifegrad** – gestapelte Leiste mit der Verteilung der Karten „Neu“, „Lernend“, „Jung“ und „Älter“.
- **7-Tage-Prognose** – Sparkline mit der prognostizierten Fälligkeitszahl für die nächste Woche
- **FSRS-Speicherzustand** – durchschnittliche Stabilität und Schwierigkeit mit einem farbcodierten Gesundheitsindikator

### Massenoperationen

Wählen Sie mithilfe der Kontrollkästchen mehrere Karten aus und verwenden Sie dann die Symbolleiste für Massenaktionen:

- **Suspendieren / Suspendieren aufheben** – Batch-Sperrung umschalten
- **Löschen** – ausgewählte Karten entfernen (mit Bestätigung)
- **Neu taggen** – Tags auf allen ausgewählten Karten gleichzeitig hinzufügen oder entfernen

### Tastaturkürzel

| Schlüssel | Aktion |
|-----|--------|
| „Flucht“ | Inline-Editor einklappen oder erweitertes Deck einklappen |

---

## Überprüfungsprozess

### Starten einer Überprüfungssitzung

1. Klicken Sie in der Seitenleiste auf **Überprüfen**
2. Sehen Sie sich die Karten an, die heute (und in Kürze) fällig sind.
3. Klicken Sie auf **Überprüfung starten**, um zu beginnen

### Review-Schnittstelle

**Kartenanzeige:**
- Vorderseite der Karte angezeigt (Frage oder Aufforderung)
- Drücken Sie die **Leertaste** oder klicken Sie, um die Antwort anzuzeigen
- Die Antwort erscheint unten

**Gemischte Überprüfungssitzungen (Karten + Dokumente):**
- Überprüfungssitzungen können **Lernelemente** und **Dokumente** umfassen, die zum Lesen anstehen.
- Wenn ein Dokument erscheint, können Sie es direkt von der Sitzungskarte aus öffnen.
- Durch die Bewertung eines Dokuments wird der nächste Lesetermin festgelegt, genau wie bei einer Karte die nächste Überprüfung.

**Bewertungsschnittstelle:**
Nachdem Sie die Antwort angezeigt haben, erscheinen vier Bewertungsschaltflächen:

„
[Noch einmal] [Schwer] [Gut] [Leicht]
  ~10m ~2T ~7T ~14T
„

Jede Schaltfläche zeigt das **nächste Überprüfungsdatum** an – dies ist die Funktion **Vorschauintervall**!

**Wiederherstellungsaktionen (Überprüfungswarteschlangen-Inspektor):**
Verwenden Sie diese, wenn der Zeitplan eines Lernelements eine schnelle Änderung erfordert:

- **Intervalle komprimieren**: Die nächste Überprüfung näher bringen (kürzeres Intervall).
- **Intelligent neu planen**: Verschieben Sie den Artikel auf „Jetzt fällig“.
- **Downgrade-Häufigkeit**: Die nächste Bewertung wird verschoben (längeres Intervall).

Diese Aktionen gelten **nur für Lernelemente** und aktualisieren den Zeitplan sofort.

### Tastaturkürzel (Überprüfungsmodus)

| Schlüssel | Aktion |
|-----|--------|
| „Weltraum“ | Antwort anzeigen |
| `1` | Bewerten Sie „Noch einmal“ |
| `2` | Bewerten Sie „Schwer“ |
| `3` | Bewerten Sie „Gut“ (empfohlene Standardeinstellung) |
| `4` | Bewerten Sie „Einfach“ |
| `Strg+Enter` | Antwort anzeigen |
| „Strg+1/2/3/4“ | Bewerten, ohne Antwort anzuzeigen |
| „Esc“ | Sitzung pausieren/beenden |
| `Strg+E` | Aktuelle Karte bearbeiten (noch nicht implementiert) |
| `Strg+D` | Aktuelle Karte löschen (wird auch global für „Gehe zum Dashboard“ verwendet) |

### Sitzungsverwaltung

**Funktionen der Überprüfungssitzung:**
- **Fortschrittsbalken**: Zeigt die verbleibenden Karten an
- **Zeiterfassung**: Zeigt die Sitzungsdauer an
- **Pausen-Timer**: Optional werden alle N Karten unterbrochen
- **Sitzungslimits**: Legen Sie maximale Karten oder Zeit pro Sitzung fest

**Beenden einer Sitzung:**
- Klicken Sie auf **Fertig stellen**, wenn Sie fertig sind
- Oder legen Sie ein Limit fest (Einstellungen → Überprüfung → Sitzungslimits)
- Nicht abgeschlossene Karten bleiben für die nächste Sitzung fällig

### Überprüfungsstrategien

#### Tägliche Überprüfungsroutine

1. **Morgensitzung** (15-30 Min.)
   - Überprüfungskarten, die über Nacht fällig sind
   - Konzentrieren Sie sich auf schwierigere Gegenstände

2. **Abendsitzung** (15-30 Min.)
   - Bewertungskarten wurden tagsüber hinzugefügt
   - Erstellen Sie neue Karten aus dem Lesen

#### Rückstand verwalten

Wenn Sie viele Karten fällig haben (>100):

1. **Konzentrieren Sie sich auf neue Karten**: Beschränken Sie die Überprüfung auf 20–30/Tag
2. **Filter verwenden**: Überprüfung nach Kategorie (nicht überfordern)
3. **Cram Sessions**: Nachholsitzungen am Wochenende
4. **Bindung anpassen**: Vorübergehend auf 85 % senken (weniger Bewertungen)

#### Umgang mit „Again“-Karten

Mit „Wieder“ bewertete Karten erscheinen schnell wieder (10 Min.). Strategien:

- **Sofortiges Umlernen**: Überprüfen Sie die Karten innerhalb derselben Sitzung noch einmal
- **Separate Sitzung**: Überprüfen Sie die Karten später am Tag noch einmal
- **Verständnisprobleme**: Bei vielen Gegenstimmen ist die Karte möglicherweise schlecht geschrieben

---

## Warteschlangenverwaltung

### Die Warteschlange verstehen

Die **Warteschlange** enthält alle zur Überprüfung geplanten Elemente, sortiert nach:

- **Fälligkeitsdatum**: Elemente, die früher fällig sind, werden zuerst angezeigt
- **Priorität**: Vom Benutzer festgelegte Priorität (0-100)
- **Kategorie**: Themenbereich
- **Kartentyp**: Karteikarte, Lückentext usw.

### Warteschlangenansichten

#### Due Ansicht
Zeigt heute fällige und überfällige Elemente, sortiert nach Fälligkeitszeit

#### Geplante Ansicht
Zeigt alle geplanten Artikel an, einschließlich zukünftiger Bewertungen

#### Neue Ansicht
Zeigt neu erstellte Karten an, die noch nicht überprüft wurden

### Warteschlangenoperationen

**Filterung:**
- Nach Kategorie (z. B. „Nur Programmierung anzeigen“)
- Nach Kartentyp (z. B. „Nur Lückentextkarten anzeigen“)
- Nach Prioritätsbereich (z. B. „Priorität 80+ anzeigen“)

**Sortierung:**
- Fälligkeitsdatum (Standard)
- Priorität
- Schwierigkeit
- Zufällig (zur Abwechslung)

**Massenaktionen:**
1. Mehrere Elemente auswählen (Kontrollkästchen)
2. Aktion auswählen:
   - **Kategorie ändern**: In eine andere Kategorie wechseln
   - **Priorität festlegen**: Priorität für Massenaktualisierungen
   - **Sperren**: Vorübergehend aus Bewertungen ausblenden
   - **Löschen**: Dauerhaft entfernen

### Prioritätssystem

Legen Sie für jedes Element eine Priorität von 0 bis 100 fest:

- **100**: Kritisch (muss gelernt werden)
- **80-90**: Wichtig
- **60-70**: Normale Priorität
- **40-50**: Niedrige Priorität
- **0-20**: Archiv/Referenz

**Prioritätsplanung:**
Artikel mit höherer Priorität werden in gemischten Bewertungen häufiger angezeigt.

### Intelligente Warteschlangen

Erstellen Sie benutzerdefinierte Warteschlangen mit Filtern:

**Beispielwarteschlangen:**
- „Heutiger Fokus“: Fällige Karten aus der Hauptkategorie
- „Quick Review“: Einfache Karten, Priorität < 50
- „Deep Dive“: Harte Karten aus der Forschungskategorie
- „Prüfungsvorbereitung“: Alle Karten in der Kategorie „Biologie“.

**Intelligente Warteschlange erstellen:**
1. Klicken Sie auf **Warteschlange** → **Gespeicherte Warteschlangen**
2. Klicken Sie auf **Neue Warteschlange**
3. Legen Sie Filter und Sortierreihenfolge fest
4. Benennen und speichern

---

## Analysen und Fortschrittsverfolgung

### Dashboard-Übersicht

Das Analytics-Dashboard bietet umfassende Einblicke:

**Wichtige Kennzahlen:**
- **Heute fällige Karten**: Nummer wartet auf Überprüfung
- **Gesamtkarten**: Alle Karten im System
- **Retentionsrate**: Erinnerungsrate in Prozent
- **Studiensträhne**: Aufeinanderfolgende Aktivitätstage
- **Gelernte Karten**: Gesamtzahl der erstellten Karten

### Aktivitätsdiagramme

**30-Tage-Aktivität:**
- Balkendiagramm mit Bewertungen pro Tag
- Farbcodiert nach Bewertung (Wieder/Schwer/Gut/Einfach)
- Identifizieren Sie Muster in Ihren Lerngewohnheiten

**Lernkurve:**
- Liniendiagramm, das die Gesamtzahl der Karten im Zeitverlauf zeigt
- Verfolgen Sie das Wachstum Ihrer Wissensdatenbank

### Statistik

**Bewertungsstatistiken:**
- Gesamtzahl der abgeschlossenen Bewertungen
- Durchschnittliche Bewertungsverteilung
- Bewertungen pro Tag/Woche/Monat

**Kartenstatistiken:**
- Gesamtzahl der Karten nach Kategorie
- Karten nach Typ (Lernkarte, Lückentext usw.)
- Neue vs. ausgereifte Karten

**Algorithmusmetriken (FSRS/SM-18):**
- Durchschnittliche Stabilität
- Durchschnittlicher Schwierigkeitsgrad
- Voraussichtliche Aufbewahrung
- Speicherleistung

### Kategorieaufschlüsselung

Leistung nach Themenbereich anzeigen:

- Karten pro Kategorie
- Retentionsrate pro Kategorie
- Aktivitätsniveau pro Kategorie
- Identifizieren Sie Stärken/Schwächen

### Tore und Erfolge

**Ziele setzen:**
1. Klicken Sie auf **Analysen** → **Ziele**
2. Legen Sie tägliche/wöchentliche Ziele fest:
   - Karten zum Überprüfen
   - Karten zum Erstellen
   - Lernzeit
3. Verfolgen Sie den Fortschritt mithilfe visueller Indikatoren

**Studienstränge:**
- Aufeinanderfolgende Tage mit Aktivität
- Aktueller Streak wird auf dem Dashboard angezeigt
- Halten Sie Motivationssträhne aufrecht

### Statistiken exportieren

Exportieren Sie Ihre Daten zur Analyse:

1. Klicken Sie auf **Analysen** → **Exportieren**
2. Format wählen:
   - **CSV**: Tabellenkalkulationskompatibel
   - **JSON**: Für benutzerdefinierte Analysen
   - **PDF**: Druckbarer Bericht
3. Wählen Sie den Datumsbereich aus
4. Beziehen Sie Kennzahlen ein (Bewertungen, Karten, Kundenbindung)

---

## Einstellungen und Anpassung

### Darstellungseinstellungen

#### Themen
- **147 integrierte Themen**: 26 moderne kuratierte Themen und 121 Legacy-Themen (dunkel und hell)
- **Live-Vorschau**: Theme-Änderungen sofort sehen
- **Benutzerdefinierte Designs**: Erstellen Sie Ihre eigenen Farbschemata

**Themenoptionen:**
- Modern Dark (Standard dunkel)
- Material You (Material Design 3)
- Aurora-Licht
- Eisblau
- Nocturne Dark, Snow, Cartographer, Focus und viele mehr ...

#### Benutzerdefinierte Theme-Erstellung

1. Einstellungen → Erscheinungsbild → Design anpassen
2. Farben anpassen:
   - Primärfarbe
   - Hintergrundfarbe
   - Textfarbe
   - Akzentfarben
3. Als benutzerdefiniertes Design speichern
4. Themen zum Teilen exportieren/importieren

#### Anzeigeoptionen
- **Dense-Modus**: Mehr Inhalte pro Bildschirm anzeigen
- **Schriftfamilie**: Wählen Sie aus 65 integrierten Schriftarten in 5 Kategorien:
  - Sans-Serif (25): Inter, Poppins, Montserrat, Space Grotesk und mehr
  - Serif (5): Merriweather, Playfair Display, Lora, Crimson Text, Bitter
  - Monospace (31): JetBrains Mono, Fira Code, Source Code Pro und mehr
  - Display (2): Comic Neue, Major Mono Display
  - System (4): System UI, System Serif, System Sans, System Mono
- **Schriftgröße**: Textgröße anpassen
- **Kartenanimation**: Animationen aktivieren/deaktivieren
- **Vorschauintervalle anzeigen**: Zeigt die nächsten Überprüfungstermine an

### Lerneinstellungen

#### Algorithmusauswahl

Incrementum unterstützt drei Planungsalgorithmen. Wählen Sie diejenige, die am besten zu Ihrem Lernstil passt:

**FSRS-6 (empfohlen):**
- Modern, forschungsgestützt
- Passt sich dem individuellen Gedächtnis an
- Sagt Zeiten des Vergessens voraus
- Bessere Bindung mit weniger Bewertungen

**SM-18 (SuperMemo 18):**
- Neuester SuperMemo-Algorithmus, rückentwickelt von der Originalanwendung
- Verwendet eine 3D-SInc-Suchmatrix (Stabilitätssteigerung) für Schwierigkeit, Stabilität und Wiederauffindbarkeit
- Explizite Schwierigkeitsverfolgung mit nachlaufenden Durchschnittsaktualisierungen
- Exponentielles Vergessenskurvenmodell: „R = 0,9^(t/S)“.
- Ausgeklügelte Fehlerbehandlung mit ausfallabhängiger Stabilitätsreduzierung

**SM-2 (klassisch):**
- Traditioneller SuperMemo 2-Algorithmus (öffentlich dokumentiert)
- Einfacher, vorhersehbar
- Weitere Bewertungen erforderlich

#### Parameter

**Gewünschte Retention:** 0,70 - 0,95
- **90 %** (Standard): Gleicht Aufbewahrung und Überprüfungslast aus
- **85 %**: Weniger Bewertungen, etwas weniger Bindung
- **95 %**: Maximale Bindung, mehr Bewertungen

**Lernen pro Tag:** 10–100
- **20** (Standard): Für die meisten Benutzer verwaltbar
- **50**: Für intensive Lernphasen
- **10**: Geringe Rezensionslast

**Bewertung pro Tag:** 50 - 500
- **200** (Standard): Angemessenes Tageslimit
- **500**: Zum Beseitigen von Rückständen
- **50**: Leichte Rezensionstage

#### Intervalleinstellungen

**Neue Kartenintervalle:**
- Abschlussintervall (gute Bewertung): 1-10 Tage
- Einfaches Intervall: 3-21 Tage
- Mindestintervall: 1 Tag

**Maximales Intervall:**
- Begrenzen Sie die längsten Intervalle (Standardeinstellung: 365 Tage).
- Verhindert, dass Karten zu weit im Voraus geplant werden

**Lange Sicherheitskappe (Videos/Artikel):**
- Bei langen Videos/Artikeln sind positive Bewertungen („Gut“/„Einfach“) berichterstattungsabhängig.
- Wenn Sie weniger als **25 %** der geschätzten Inhaltszeit verbringen, ist das nächste Intervall auf **1 Tag** begrenzt.
- Wenn Sie weniger als **50 %** ausgeben, ist das nächste Intervall auf **2 Tage** begrenzt.
- Wenn Sie weniger als **75 %** ausgeben, ist das nächste Intervall auf **4 Tage** begrenzt.
– Dadurch wird verhindert, dass lange Inhalte nach einem Teilfortschritt zu weit nach hinten eingeplant werden.
– Bei Anwendung enthält der Planergrund zur Transparenz einen Hinweis zur **Dauerabhängigen Obergrenze**.

### Überprüfen Sie die Einstellungen

#### Sitzungslimits**Zeitlimits:**
- Maximale Sitzungsdauer (Minuten)
- Pausenintervalle
- Automatisches Ende nach Limit

**Kartenlimits:**
- Maximale Anzahl an Karten pro Sitzung
- Separates Limit für neue Karten
- Wieder Kartenlimit

#### Bewertungsoptionen

**Bewertungsverknüpfungen:**
- Passen Sie Tastaturkürzel an
- Standardbewertung festlegen (Leertaste)
- Bewertungsverknüpfungen aktivieren/deaktivieren

**Automatischer Vorlauf:**
- Nach der Bewertung automatisch zur nächsten Karte wechseln
- Verzögerung vor dem automatischen Vorlauf (Sekunden)

### Allgemeine Einstellungen

#### Automatisch speichern
- Speicherintervall (Sekunden)
- Sparen Sie bei der Kartenbewertung
- Beim Tab-Wechsel speichern

#### Aktuelle Dokumente
- Max. aktuelle Artikel (5-50)
- Löschen Sie aktuelle Dokumente

#### Standardkategorie
- Kategorie für neue Artikel festlegen
- Kann pro Artikel überschrieben werden

#### Statistik
- Verfolgen Sie die Überprüfungszeit
- Verfolgen Sie die Anzahl der Karten
- Aktualisierungsintervall (Echtzeit vs. periodisch)

### Synchronisierungseinstellungen

#### Browser-Synchronisierung
- Aktivieren/deaktivieren Sie die Synchronisierung der Browsererweiterung
- Synchronisierungsintervall (Minuten)
- Konfliktlösung (Local Wins / Remote Wins / Ask)

#### Cloud-Synchronisierung

**Unterstützte Anbieter:**
- Dropbox
- Google Drive
- OneDrive

**Synchronisierungsoptionen:**
- Automatische Synchronisierung bei Änderungen
- Synchronisierungsintervall (manuell, 15 Min., 30 Min., 1 Std.)
- Synchronisierung beim Starten/Schließen der App
- Konfliktbearbeitung

#### Sichern und Wiederherstellen

Incrementum bietet ein vollständiges Sicherungs- und Wiederherstellungssystem zum Schutz Ihrer Lerndaten und zur Migration zwischen Geräten.

#### Vollständige App-Sicherung

**Was gesichert wird:**
- **Einstellungen**: Alle Präferenzen, Themen, Lernparameter
- **Dokumente**: Alle importierten Dokumente mit Metadaten
- **Auszüge**: Alle Highlights und extrahierten Inhalte
- **Lernelemente**: Alle Lernkarten, Lückentexte, Frage-und-Antwort-Karten
- **Planungsdaten**: Speicherzustände des Algorithmus (Stabilität, Schwierigkeit, Intervalle), Fälligkeitstermine
- **Sammlungen**: Alle Sammlungen und Dokumentenzuordnungen
- **UI-Status**: Seitenleistenstatus, Designeinstellungen
- **Optional**: Tatsächliche Dokumentdateien (PDFs, EPUBs usw.)

**Erstellen eines Backups:**

1. Gehen Sie zu **Einstellungen → Import/Export → Vollständige App-Sicherung**
2. Klicken Sie auf **Sicherung und Wiederherstellung öffnen**
3. Wählen Sie **Backup exportieren**
4. Fügen Sie eine optionale Beschriftung hinzu (z. B. „Vor der Neuformatierung des PCs“).
5. Wählen Sie aus, ob Dokumentdateien einbezogen werden sollen:
   - **Nur Metadaten**: Kleinere Datei (~KB-MB), Dateien separat erneut importieren
   - **Dateien einschließen**: Größere Datei (~MB-GB), vollständige eigenständige Sicherung
6. Klicken Sie auf **Backup exportieren** und speichern Sie die Datei „.incrementum“.

**Dateiformat:**
- Erweiterung: `.incrementum`
- Format: JSON mit Header-Kommentar
- Benennung: `incrementum-backup-[label]-[date]-[time].incrementum`

**Wiederherstellung aus Backup:**

1. Gehen Sie zu **Einstellungen → Import/Export → Vollständige App-Sicherung**
2. Klicken Sie auf **Sicherung und Wiederherstellung öffnen**
3. Wählen Sie **Backup importieren**
4. Wählen Sie Ihre „.incrementum“-Datei
5. Sehen Sie sich den Inhalt des Backups in der Vorschau an:
   - Anzahl der Dokumente
   - Anzahl extrahieren
   - Anzahl der Lernelemente
   - Anzahl der Sammlungen
   - Ob Dateien enthalten sind
6. Importoptionen konfigurieren (optional):
   - **Was importiert werden soll**: Wählen Sie bestimmte Datentypen aus
   - **Duplikatbehandlung**: Überspringen, Ersetzen oder Zusammenführen
   - **Dateien importieren**: Ob Dokumentdateien wiederhergestellt werden sollen
7. Klicken Sie auf **Backup importieren**
8. Warten Sie, bis der Import abgeschlossen ist (Fortschritt wird angezeigt).

**Strategien zum Umgang mit Duplikaten:**
- **Überspringen**: Bereits vorhandene Elemente überspringen (in den meisten Fällen empfohlen)
- **Ersetzen**: Vorhandene Elemente mit Sicherungsversionen überschreiben
- **Zusammenführen**: Neue Kopien aller Elemente erstellen (kann Duplikate erstellen)

**Anwendungsfälle:**| Szenario | Empfohlener Ansatz |
|----------|-------|
| **Auf neuen Computer migrieren** | Mit Dateien exportieren, auf neuem Rechner importieren |
| **Backup vor größeren Änderungen** | Schnelle Nur-Metadaten-Sicherung |
| **Sync zwischen Geräten** | Export-/Import-Workflow |
| **Sammlungen teilen** | Bestimmte Sammlungen exportieren |
| **Alte Daten archivieren** | Exportieren und langfristig lagern |
| **Wiederherstellen nach Neuformatierung** | Vollständiges Backup mit Dateien importieren |

**Wichtige Hinweise:**
- **Terminerhaltung**: Alle Planungsdaten (Stabilität, Schwierigkeit, Fälligkeitstermine) für alle Algorithmustypen werden exakt beibehalten
- **Dateipfade**: Beim Importieren ohne Dateien müssen Sie die Originaldokumente erneut importieren. Incrementum gleicht sie anhand des Inhalts-Hashs ab und stellt die Metadaten wieder her
- **Versionskompatibilität**: Backups sind aufwärtskompatibel, funktionieren aber möglicherweise nicht mit älteren App-Versionen
- **Speicher**: Bewahren Sie Backups sicher auf – sie enthalten Ihre persönlichen Lerndaten

#### Legacy-Backup-Optionen

**Automatische Backups:**
- Backup-Frequenz (täglich, wöchentlich)
- Maximal aufzubewahrende Backups (5–50)
- Backup-Speicherort

**Manuelle Sicherung:**
- Einstellungen → Backup → Backup erstellen
- Standort wählen
- Beinhaltet alle Daten und Einstellungen

**Wiederherstellen:**
- Einstellungen → Backup → Wiederherstellen
- Sicherungsdatei auswählen
- Wiederherstellung bestätigen (aktuelle Daten werden ersetzt)

### Tastaturkürzel

#### Globale Verknüpfungen

| Verknüpfung | Aktion |
|----------|--------|
| `Strg+K` | Befehlspalette öffnen |
| `Strg+P` | Befehlspalette öffnen (alternativ) |
| `Strg+,` | Öffnen Sie die Einstellungen |
| `Strg+D` | Gehen Sie zum Dashboard |
| `Strg+Q` | Zur Warteschlange gehen |
| `Strg+R` | Rezension starten |
| `Strg+O` | Dokument öffnen |
| `Strg+N` | Dokument importieren (alternativ) |

#### Anpassung

1. Einstellungen → Tastenkombinationen
2. Wählen Sie die Aktion zur Neuzuordnung aus
3. Drücken Sie die neue Tastenkombination
4. Änderungen speichern

**Auf Standardeinstellungen zurücksetzen:** Klicken Sie auf die Schaltfläche „Alle zurücksetzen“.

### Integrationseinstellungen

#### Anki-Integration

**Einrichtung:**
1. Einstellungen → Integrationen → Anki
2. Konfigurieren Sie die AnkiConnect-URL (Standard: „http://localhost:8765“).
3. Testen Sie die Verbindung
4. Aktivieren Sie die bidirektionale Synchronisierung

**Synchronisierungsoptionen:**
- Bei der Kartenerstellung mit Anki synchronisieren
- Synchronisierungsintervalle von Anki
- Deck-Mapping (Inkrementum-Kategorie → Anki-Deck)
- Tag-Synchronisierung

#### Obsidian-Integration

**Einrichtung:**
1. Einstellungen → Integrationen → Obsidian
2. Legen Sie den Tresorpfad fest
3. Vorlage konfigurieren
4. Aktivieren Sie die Synchronisierung

**Synchronisierungsfunktionen:**
- Exportieren Sie Karten in Obsidian-Notizen
- Importieren Sie Notizen als Karten
- Integration täglicher Notizen
- Bidirektionale Tag-Synchronisierung

#### NotebookLM-Integration

Verwenden Sie NotebookLM in Incrementum, um zu recherchieren, Studienartefakte zu generieren und überprüfbare Auszüge zu speichern.

**Einrichtung:**
1. Einstellungen → Funktionen → **NotebookLM** aktivieren
2. Einstellungen → Integrationen → **NotebookLM**
3. Klicken Sie auf **Verbinden** und wählen Sie den Anbieter („mock“ zum Testen, „cli“ für Live-NotebookLM).
4. Wählen Sie ein aktives Notizbuch aus oder erstellen Sie es

**Was Sie tun können:**
- Stellen Sie Fragen im NotebookLM-Chat direkt von Incrementum aus
- Führen Sie Rechercheaufforderungen durch (webgestützte Notebook-Recherche)
- Artefakte generieren:
  - Karteikarten
  - Quiz
  - Bericht / Studienführer
  - Mindmap
  - Datentabelle
  - Audioübersicht
  - Videoübersicht
- Vorschau von Artefakten in der App (einschließlich Audio-/Videoplayer, wenn Medien verfügbar sind)
- Synchronisieren Sie generierte Karteikarten/Quizelemente in die Incrementum-Überprüfungswarteschlange**Chat-Antworten als Auszüge speichern:**
1. Öffnen Sie den NotebookLM-Workspace-Chat
2. Klicken Sie in einer beliebigen Assistentenantwort auf **Als Extrakt speichern**
3. Optional: Markieren Sie zuerst einen Teil der Antwort, um nur den ausgewählten Text zu speichern
4. Incrementum erstellt einen mit NotebookLM verknüpften Extrakt mit Thread-/Quellenmetadaten
5. Gespeicherte Antworten werden mit der Markierung „bereits gespeichert“ angezeigt, um Duplikate zu vermeiden

**Fragen und Antworten zu Dokumenten + NotebookLM-Workflow:**
1. Öffnen Sie ein Dokument in Incrementum
2. Verwenden Sie **Dokument-Fragen und Antworten** mit dem NotebookLM-Recherchemodus
3. Bearbeiten/verfeinern Sie den generierten Antworttext inline
4. Erstellen Sie Auszüge aus der verfeinerten Antwort
5. Generieren Sie Lernkarten/Lückentexte/Fragen und Antworten aus diesen Auszügen

**Fehlerbehebung:**
– Wenn in der Artefaktvorschau angezeigt wird, dass das Medium nicht verfügbar ist, warten Sie, bis die NotebookLM-Generierung abgeschlossen ist, und öffnen Sie das Artefakt erneut.
- Wenn Sie den CLI-Anbieter verwenden, stellen Sie sicher, dass der NotebookLM-Sidecar/CLI in Ihrem Build verfügbar ist.
- Wenn Sie den Anbieter gewechselt haben oder die Authentifizierung abgelaufen ist, stellen Sie die Verbindung unter Integrationen → NotebookLM erneut her.

#### MCP-Server

**Model Context Protocol (MCP)-Server:**

Verbinden Sie bis zu 3 MCP-Server für KI-gestützte Funktionen:

1. Einstellungen → AI → MCP-Server
2. Server-URL hinzufügen
3. Konfigurieren Sie die Authentifizierung
4. Funktionen aktivieren:
   - Smartcard-Generierung
   - Zusammenfassung des Inhalts
   - Unterstützung bei Fragen und Antworten
   - Automatisches Tagging

### AI-Einstellungen

#### QA-Anbieter

Konfigurieren Sie KI-Anbieter für die Kartengenerierung:

**Unterstützte Anbieter:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropisch (Claude)
- Ollama (lokale Modelle wie Llama, Mistral, Qwen)
- OpenRouter (Zugriff auf viele Modelle, einschließlich kostenloser Stufen)
- llama.cpp / vLLM (jedes GGUF-Modell über OpenAI-kompatible API)
- Benutzerdefinierte API-Endpunkte

**Einstellungen pro Anbieter:**
- API-Schlüssel
- Modellname
- Temperatur (Kreativität)
- Max. Token
- Systemaufforderung

#### Automatische Generierung

**Kartenerstellung:**
- Aktivieren Sie die automatische Generierung aus Extrakten
- Anzahl der Karten pro Auszug
- Qualitätsschwelle
- Manuelle Genehmigung erforderlich

**Zusammenfassung:**
- Lange Auszüge automatisch zusammenfassen
- Zusammenfassungslänge (kurz, mittel, lang)
- In den Karteninhalt einbeziehen

#### Kontextfenster

**Token-Limits:**
- Max. Token pro Anfrage
- Kontext aus verwandten Karten
- Länge des Dokumentausschnitts

---

## Erweiterte Funktionen

### Wissensgraph

Visualisieren Sie Zusammenhänge zwischen Ihrem Wissen:

**2D-Grafikansicht:**
- Knoten: Dokumente, Auszüge, Karten
- Kanten: Beziehungen (gleiche Kategorie, Tags, Referenzen)
- Zwangsgesteuertes Layout
- Interaktive Navigation

**3D-Wissensbereich:**
- Immersive 3D-Visualisierung
- Drehen, zoomen, schwenken
- Farbcodiert nach Kategorie
- Klicken Sie auf Knoten, um Inhalte anzuzeigen

**Eigenschaften:**
- Suchen und filtern
- Markieren Sie verwandte Elemente
- Als Bild exportieren
- Identifizieren Sie Wissenslücken

### RSS-Reader

Lernen Sie von Ihren Lieblings-Feeds:

#### Newsletter-Verzeichnis

Entdecken und abonnieren Sie beliebte Newsletter direkt in Incrementum:

**Zugriff auf das Newsletter-Verzeichnis:**
1. Klicken Sie auf die Registerkarte **RSS**
2. Klicken Sie in der Kopfzeile auf das **Newsletter-Symbol** (📬).
3. Durchsuchen Sie kuratierte Newsletter nach Kategorie

**Newsletter-Kategorien:**
- **Technologie**: Tech-News, Programmierung, KI
- **Wissenschaft**: Forschung, Entdeckungen, wissenschaftliche Erkenntnisse
- **Finanzen**: Investieren, Märkte, persönliche Finanzen
- **Business**: Unternehmertum, Strategie, Firmenaufbau
- **Gesundheit**: Wellness, Medizin, gesundes Leben
- **Lebensstil**: Kultur, Reisen, Essen, persönliche Entwicklung
- **Politik**: Politik, Governance, aktuelle Ereignisse
- **Kunst und Literatur**: Bücher, Kunst, Musik, kreatives Schreiben
- **Bildung**: Lernen, Lehren, akademische Erkenntnisse
- **Crypto & Web3**: Neuigkeiten zu Blockchain, DeFi und Kryptowährungen

**Newsletter abonnieren:**
1. Durchsuchen Sie das Verzeichnis oder suchen Sie nach einem Newsletter
2. Klicken Sie in einem beliebigen Newsletter auf **Abonnieren**
3. Der Feed wird automatisch zu Ihren RSS-Abonnements hinzugefügt
4. Neue Ausgaben werden in Ihrem RSS-Reader angezeigt

**Newsletter-Feed-Erkennung:**

Incrementum kann RSS-Feeds von beliebten Newsletter-Plattformen automatisch erkennen:

- **Substack**: Fügen Sie „/feed“ zu jeder Substack-URL hinzu
  - Beispiel: „https://author.substack.com“ → „https://author.substack.com/feed“.
- **Beehiiv**: Erkennt automatisch den „/feed“-Endpunkt
- **Ghost-Blogs**: Erkennt den Endpunkt „/rss/“ automatisch
- **Buttondown**: Fügen Sie „/feed“ zur Newsletter-URL hinzu
- **Generisch**: Erkennt RSS-Feeds automatisch aus HTML-Tags „<link>“.

**Schnelles Abonnieren über URL:**
1. Kopieren Sie eine beliebige Newsletter-URL
2. Klicken Sie auf der Registerkarte „RSS“ auf **Feed hinzufügen**
3. Fügen Sie die URL ein
4. Incrementum erkennt den RSS-Feed automatisch
5. Klicken Sie zum Abonnieren auf **Feed hinzufügen**

**Suchen von Newsletter-RSS-Feeds:**

Die meisten Newsletter-Plattformen veröffentlichen RSS-Feeds:

| Plattform | RSS-Feed-Muster | Beispiel |
|----------|----|---------|
| Unterstapel | `https://[author].substack.com/feed` | `https://stratechery.substack.com/feed` |
| Bienenhiiv | `https://[newsletter].beehiiv.com/feed` | `https://banklesshq.beehiiv.com/feed` |
| Geist | `https://[blog].ghost.io/rss/` | `https://blog.ghost.io/rss/` |
| Knopfleiste | `https://buttondown.email/[name]/feed` | `https://buttondown.email/newsletter/feed` |

**Unterstützte Plattformen:**
- Substack (die meisten Newsletter)
- Beehiiv
- Geisterblogs
- Knopfleiste
- ConvertKit
- Revue
- Mittlere Veröffentlichungen
- WordPress-Sites (allgemein)

**Newsletter-Abonnements importieren/exportieren:**
- **OPML-Import**: Import aus anderen RSS-Readern
- **OPML-Export**: Sichern Sie Ihre Newsletter-Abonnements
- Teilen Sie Abonnements zwischen Geräten

#### Feed-Management

1. Klicken Sie auf die Registerkarte **RSS**
2. Klicken Sie auf **Feed hinzufügen**
3. Geben Sie die Feed-URL ein
4. Aktualisierungsintervall festlegen
5. Aktivieren Sie den automatischen Import in die Warteschlange

**Feed-Funktionen:**
- Automatische Umfrage für neue Artikel
- Artikel als Dokumente importieren
- Wichtige Punkte automatisch extrahieren
- Erstellen Sie Karten aus Feeds**Empfohlene Feeds:**
- Nachrichtenseiten (BBC, CNN usw.)
- Blogs in Ihrem Bereich
- Forschungszeitschriften
- Tech-News (Hacker News, Ars Technica)

### YouTube-Integration

**Videoimport:**
1. YouTube-URL kopieren
2. Als Dokument importieren
3. Inkrementelle Abrufe:
   - Video-Metadaten
   - Transkript (falls vorhanden)
   - Kapitelinformationen
   - Kommentare (optional)

**Funktionen des Transkripts:**
- Vollständiges Transkript durchsuchbar
- Erstellen Sie Auszüge aus dem Transkript
- Transkript mit Video synchronisieren
- Erstellen Sie Karten mit Zeitstempeln

**Videofunktionen-Panel:**
- Öffnen Sie die Schaltfläche **Panels** im Video-Viewer
- Registerkarten für Lesezeichen, Kapitel, Transkript
- Lesezeichen speichern Zeitstempel für schnelle Sprünge
- Kapitel können von YouTube abgerufen werden

**Videoauszüge:**
1. Öffnen Sie **Panels** → **Video-Extrakte**
2. Klicken Sie auf **Neu**
3. Legen Sie Start/Ende und optionalen Transkripttext fest
4. Speichern Sie, um einen wiederverwendbaren Clip zu erstellen

**SponsorBlock-Integration:**
- Gesponserte Segmente automatisch überspringen
- Kategoriefilterung
- Tragen Sie zu SponsorBlock bei

**Fortschrittsverfolgung:**
- Von der letzten Position fortfahren
- Markieren Sie beobachtete Abschnitte
- Geschichte ansehen

### Lokale Videotranskription (Desktop-App)

Generieren Sie Transkripte für lokale Videodateien in der Tauri-Desktop-App.

1. Öffnen Sie ein lokales Video
2. Öffnen Sie **Panels** → **Transcript**
3. Wählen Sie ein Modell und eine Sprache
4. Klicken Sie auf **Transkript generieren**

Hinweise:
- Die Transkription wird lokal auf Ihrem Computer ausgeführt
- Erfordert einen lokalen Dateipfad (nicht verfügbar für reine Webvideos)

### Hörbuch-Transkription (Desktop-App)

Erstellen Sie Transkripte für Hörbücher, um die Textauswahl und -synchronisierung zu ermöglichen.

1. Importieren Sie ein Hörbuch
2. Öffnen Sie den Hörbuch-Viewer
3. Klicken Sie auf **Lokale Transkription starten**
4. Überwachen Sie den Fortschritt und öffnen Sie das Transkriptfenster

Hinweise:
- Die Transkription wird lokal auf Ihrem Computer ausgeführt
- Modelle werden unter **Einstellungen → Audiotranskription** verwaltet.

### OCR (Optische Zeichenerkennung)

Text aus Bildern extrahieren:

**Unterstützte Anbieter:**
- GLM-OCR (Lokal) – multimodale OCR über llama.cpp oder vLLM
- Tesseract (lokal)
- Google Cloud Vision
- AWS Textract
- Azure Computer Vision
- Marker (Lokal) – PDF zu Markdown
- Nougat (lokal) – wissenschaftliche Dokumente mit Mathematik

**Anwendungsfälle:**
- Screenshot-Erfassung
- Gescannte Dokumente
- Bilder mit Text
- Handschriftliche Notizen

**Einrichtung (Cloud-Anbieter):**
1. Einstellungen → OCR
2. Wählen Sie den Anbieter (Google, AWS oder Azure)
3. Konfigurieren Sie den API-Schlüssel und die Anmeldeinformationen
4. Sprache(n) auswählen
5. Testen Sie mit Beispielbild

**Setup (GLM-OCR mit llama.cpp):**

llama.cpp bietet einen kompakten lokalen LLM-Server für GLM-OCR, ohne dass eine GPU erforderlich ist. Es verwendet die OpenAI-kompatible API auf Port 8080.

1. **Lama.cpp erstellen** (falls noch nicht erstellt):
   „Bash
   Git-Klon https://github.com/ggml-org/llama.cpp.git
   cd llama.cpp
   cmake -B Build
   cmake --build build --config Release -j$(nproc)
   „

2. **Laden Sie ein multimodales Modell herunter** (GGUF-Format):
   „Bash
   # Qwen2.5-VL (empfohlen für OCR)
   Huggingface-cli herunterladen bartowski/Qwen2.5-VL-7B-Instruct-GGUF \
     Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf --local-dir models/
   „

3. **Starten Sie den Server**:
   „Bash
   ./build/bin/llama-server \
     -m models/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf \
     --port 8080 --host 0.0.0.0 -c 16384 -t $(nproc)
   „

4. **In Inkrementum konfigurieren**:
   - Einstellungen → OCR → Anbieter: **GLM-OCR (Lokal)**
   - Backend: **vLLM (GPU)** (dies ist der llama.cpp/vLLM-Modus – funktioniert für beide)
   - Endpunkt: „http://localhost:8080/v1“.
   - Modell: Ihr Modelldateiname (z. B. „Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf“)**Leistungstipps:**
- Verwenden Sie „-c 16384“ oder höher für lange Dokumente (Standard 4096 ist für die meisten OCR-Aufgaben zu klein)
- Verwenden Sie „-t $(nproc)“, um alle CPU-Threads zu nutzen
- Die Q4_K_M-Quantisierung bietet den besten Kompromiss zwischen Qualität und Geschwindigkeit für die CPU-Inferenz
– Erstellen Sie für die GPU-Beschleunigung llama.cpp mit CUDA-, Metal- oder Vulkan-Unterstützung

**Einrichtung (GLM-OCR mit vLLM):**

vLLM bietet GPU-beschleunigte Inferenz für größere Modelle. Erfordert eine NVIDIA-GPU mit ausreichend VRAM.

„Bash
pip install -U vllm
vllm dienen zai-org/GLM-OCR --allowed-local-media-path / --port 8080
„

Konfigurieren Sie dann Incrementum auf die gleiche Weise (Endpunkt „http://localhost:8080/v1“).

**Einrichtung (GLM-OCR mit Ollama):**

Die einfachste Option für den Einstieg: Ollama verwaltet Modell-Downloads und Laufzeit automatisch.

1. Einstellungen → OCR → Anbieter: **GLM-OCR (Lokal)**
2. Backend: **Ollama (CPU)**
3. Klicken Sie auf **Ollama herunterladen** (falls nicht installiert)
4. Klicken Sie auf **Laufzeit starten**
5. Modell festlegen (z. B. „llava:7b“ oder „qwen2-vl:7b“)
6. Klicken Sie auf **Modell ziehen**

**Mathe-OCR:**
- Spezialisierter Umgang mit Gleichungen
- LaTeX-Ausgabe
- Symbolerkennung
- Geeignet für: Wissenschaftliche Arbeiten, Lehrbücher

### Befehlspalette

Schnellzugriff auf alle Befehle:

**Öffnen:** „Strg+K“ (oder „Befehl+K“ auf dem Mac)

**Eigenschaften:**
- Fuzzy-Suche
- Tastaturnavigation
- Zuletzt verwendete Befehle
- Suche nach Namen oder Verknüpfung
- Suchergebnisse springen zur passenden Stelle in Dokumenten und markieren die Suchanfrage (PDF, EPUB, Web-Importe)
- YouTube-Transkriptübereinstimmungen suchen nach dem Zeitstempel und starten die Wiedergabe
- Bewegen Sie den Mauszeiger über ein Dokumentergebnis, um weitere Übereinstimmungen aus demselben Dokument anzuzeigen

**Allgemeine Befehle:**
- „Dokument importieren“
- „Bewertung starten“
- „Karte erstellen“
- „Einstellungen öffnen“
- „Daten exportieren“

### Vimium-Modus

Tastaturnavigation im Vim-Stil für Power-User:

**Aktivieren:** Einstellungen → Tastenkombinationen → Vimium aktivieren

**Navigation:**
- „j“ / „k“: Nach unten/oben scrollen
- „h“ / „l“: Nach links/rechts scrollen
- `gg`: Nach oben gehen
- „G“: Nach unten gehen
- `/`: Suchen
- „n“ / „N“: Nächstes/vorheriges Suchergebnis

**Aktionen:**
- „f“: Linkhinweise (anklickbare Elemente)
- „i“: Eingabemodus aufrufen
- „Escape“: Eingabemodus verlassen

**Anpassung:**
- Tasten neu zuordnen
- Erstellen Sie benutzerdefinierte Befehle
- Teilen Sie Tastenkombinationskonfigurationen

### Suchen und Filtern

Erweiterte Suche über alle Inhalte:

**Volltextsuche:**
- Durchsuchen Sie Karteninhalte, Auszüge und Dokumente
- Boolesche Operatoren (UND, ODER, NICHT)
- Phrasensuche („exakte Phrase“)
- Wildcards (Karte*)

**Suchfilter:**
- „Kategorie:Programmierung“: Suche in der Kategorie
- `tag:urgent`: Suche nach Tag
- „type:cloze“: Suche nach Kartentyp
- „fällig: heute“: Fällige Karten suchen
- „rating:again“: Suche nach Bewertung

**Gespeicherte Suchanfragen:**
1. Suche durchführen
2. Klicken Sie auf „Suche speichern“
3. Benennen und speichern
4. Zugriff über das Such-Dropdown-Menü

### Browser-Erweiterung

Verbinden Sie Incrementum mit dem Surfen im Internet:

**Eigenschaften:**
- Markieren Sie Webseiten
- Erstellen Sie Auszüge aus Artikeln
- Mit der Desktop-App synchronisieren
- Schnell zur Warteschlange hinzufügen
- Browserbasierte Bewertungen

**Einrichtung:**
1. Erweiterung installieren (Chrome/Firefox)
2. Mit der Desktop-App koppeln
3. Erteilen Sie Berechtigungen
4. Beginnen Sie mit der Verwendung!

**Verwendung:**
- Wählen Sie Text auf der Webseite aus
- Klicken Sie auf das Erweiterungssymbol
- Wählen Sie „Zu Inkrementum hinzufügen“
- Synchronisiert automatisch

---

## Tipps und Best Practices

### Kartenerstellung

**TUN:**
- Machen Sie Karten spezifisch (ein Fakt pro Karte)
- Verwenden Sie eine einfache, klare Sprache
- Beziehen Sie den Kontext in die Antworten ein
- Fügen Sie relevante Beispiele hinzu
- Verwenden Sie Lückentexte für Beziehungen
- Halten Sie die Fragen prägnant

**NICHT:**
- Fassen Sie mehrere Fakten auf einer Karte zusammen
- Verwenden Sie vage Formulierungen
- Stellen Sie Fragen zu einfach oder zu schwer
- Kopieren Sie große Textblöcke
- Verwenden Sie Abkürzungen ohne Definition

**Beispiel – Schlechte Karte:**
„
F: Welche Funktion haben die Mitochondrien und wie funktionieren sie?
Hängt es mit der ATP-Produktion bei der Zellatmung zusammen?
A: [Absatzerklärung]
„

**Beispiel – Gute Karten:**
„
Karte 1:
F: Was ist die Hauptfunktion von Mitochondrien?
A: Produzieren Sie ATP durch Zellatmung

Karte 2:
F: Welchen Prozess verwenden Mitochondrien, um ATP zu produzieren?
A: Zellatmung (aerob)

Karte 3:
F: Was ist die Energiewährung, die von Mitochondrien produziert wird?
A: ATP (Adenosintriphosphat)
„

### Lernroutine

**Tagesplan (20-30 Min.):**
1. **Morgen**: Fällige Karten überprüfen (15 Min.)
2. **Den ganzen Tag**: Auszüge aus der Lektüre erstellen
3. **Abend**: Karten aus Auszügen erstellen (10-15 Min.)

**Wochenplan:**
- **Mo-Fr**: Regelmäßige Überprüfungen und Kartenerstellung
- **Samstag**: Längere Lerneinheiten (1-2 Stunden)
- **Sonntag**: Analysen überprüfen, Ziele anpassen, organisieren

**Verwaltung großer Volumina:**
- Legen Sie ein tägliches Überprüfungslimit fest (z. B. 50 Karten)
- Priorisieren Sie nach Kategorie (konzentrieren Sie sich auf ein Thema)
- Verwenden Sie intelligente Warteschlangen, um Aufgaben aufzuteilen
- Machen Sie alle 20-30 Minuten Pausen

### Aufbewahrungsoptimierung

**Retentionsrate verbessern:**
- Ehrlich bewerten (Bewertungen nicht übertreiben)
- Überprüfen Sie regelmäßig (am besten täglich)
- Schlafen Sie ausreichend (das Gedächtnis festigt sich im Schlaf)
- Aktive Erinnerung (nicht hinsehen, zuerst nachdenken)
- Abstandsrezensionen (nicht vollstopfen)

**Umgang mit dem Vergessen:**
- Normal zum Vergessen 10–20 % (je nach Zielerhaltung)
- „Noch einmal“-Karten sind Lernmöglichkeiten
- Wenn Sie häufig (>30 %) vergessen, berücksichtigen Sie Folgendes:
  - Senkung der gewünschten Retention (85-90 %)
  - Einfachere Karten erstellen
  - Mehr Kontext hinzufügen
  - Häufigeres Überprüfen

### Kategorieorganisation

**Best Practices:**
- Beginnen Sie breit und unterteilen Sie es dann
- Beispiel: „Programmierung“ → „Programmierung/Python“ → „Programmierung/Python/Async“.
- Verwenden Sie eine einheitliche Benennung
- Erstellen Sie nicht zu viele (5–10 sind machbar)
- Nicht verwendete Kategorien zusammenführen

**Beispiel für eine Kategoriestruktur:**
„
├── Programmierung
│ ├── Python
│ ├── Rost
│ └── Algorithmen
├── Sprachen
│ ├── Spanisch
│ └── Japanisch
├── Wissenschaft
│ ├── Physik
│ └── Biologie
└── Professionell
    ├── Projektmanagement
    └── Systemdesign
„

### Prioritätsmanagement

**Prioritätsrichtlinien:**
- **100 (kritisch)**: Prüfungsvorbereitung, dringende Arbeitsprojekte
- **80-90 (Hoch)**: Aktuelle Kurse, aktives Lernen
- **60-70 (Mittel)**: Aktuelle Interessen, Allgemeinwissen
- **40-50 (Niedrig)**: Wissenswert, ergänzend
- **0-20 (Archiv)**: Nur Referenz, selten Rezension

**Prioritätsplanung:**
- Konzentrieren Sie sich bei täglichen Bewertungen auf eine Priorität von 80+
- Überprüfen Sie alle paar Tage 60-70
- Überprüfen Sie 40-50 wöchentlich
- Überprüfen Sie 0–20 monatlich oder auf Abruf

### Verwenden von Vorschauintervallen

Die Funktion **Vorschauintervall** zeigt Ihnen genau an, wann jede Karte für alle vier Bewertungen als nächstes erscheint.

**Anwendung:**
1. Lesen Sie die Karte
2. Überprüfen Sie die Vorschauintervalle unter den Bewertungsschaltflächen
3. Wählen Sie die Bewertung basierend auf:
   - Ihr aktueller Rückruf
   - Wie schnell willst du es wiedersehen?
   - Ihr Zeitplan (z. B. bevorstehende Prüfung)**Beispielstrategie:**
- Prüfung in 2 Wochen: Bewerten Sie wichtige Karten mit „Einfach“, um sie bald wieder zu sehen
- Anstrengender Tag: Bewerten Sie „Gut“ oder „Einfach“, um Bewertungen zu platzieren
- Möchten Sie meistern: Bewerten Sie „Schwer“, um häufiger zu überprüfen

### Überwältigung bewältigen

**Zu viele Karten fällig?**
1. Überprüfungslimit festlegen (Einstellungen → Überprüfung → Max. pro Tag)
2. Konzentrieren Sie sich auf Elemente mit hoher Priorität
3. Kategorien mit niedriger Priorität vorübergehend aussetzen
4. Erwägen Sie eine geringfügige Senkung der gewünschten Retention

**Zu viel Inhalt zum Verarbeiten?**
1. Importieren Sie Dokumente schrittweise
2. Extrahieren Sie nur die wichtigsten Punkte (nicht alles)
3. Erstellen Sie gezielt Karten
4. Verwenden Sie Kategorien zum Organisieren

**Burnout?**
1. Machen Sie eine Pause (es ist in Ordnung!)
2. Reduzieren Sie die Tageslimits
3. Sperren Sie unkritische Kategorien
4. Konzentrieren Sie sich jeweils auf eine Kategorie

---

## Fehlerbehebung

### Häufige Probleme

#### Karten werden nicht in der Rezension angezeigt

**Mögliche Ursachen:**
- Alle Karten für heute überprüft
- Karten gesperrt
- Aktive Versteckkarten filtern

**Lösungen:**
1. Überprüfen Sie die Anzahl der Fälligkeiten auf der Registerkarte „Überprüfen“.
2. Warteschlange überprüfen → Stellen Sie sicher, dass die Karten nicht gesperrt sind
3. Filter löschen
4. Überprüfen Sie das Überprüfungsdatum (möglicherweise sind Karten für die Zukunft geplant).

#### Schlechte Bindungsrate

**Symptome:** Vergessen vieler Karten, häufige „Noch einmal“-Bewertungen

**Lösungen:**
1. **Kartenqualität überprüfen**: Sind die Karten klar? Eine Tatsache pro Karte?
2. **Geringere gewünschte Kundenbindung**: Versuchen Sie es mit 85 % statt 90 %
3. **Häufiger bewerten**: Tägliche Bewertungen, kein Pauken
4. **Kontext hinzufügen**: Weitere Informationen in den Antworten
5. **Karten vereinfachen**: Teilen Sie komplexe Karten in einfachere auf

#### Synchronisierungskonflikte

**Symptome:** Doppelte Karten, Datenkonflikte nach der Synchronisierung

**Lösungen:**
1. Konfliktlösungsstrategie wählen (Einstellungen → Synchronisieren)
   - **Lokale Erfolge**: Behalten Sie Ihre Änderungen bei
   - **Remote Wins**: Serveränderungen akzeptieren
   - **Fragen**: Lösen Sie jeden Konflikt manuell
2. Synchronisieren Sie regelmäßig, um Konflikte zu minimieren
3. Verwenden Sie ein primäres Gerät

#### Importfehler

**Symptome:** Der Dokumentimport schlägt fehl oder es treten Fehler auf

**Lösungen:**
1. **Dateiformat prüfen**: Stellen Sie sicher, dass das unterstützte Format (PDF, EPUB usw.) unterstützt wird.
2. **Dateigröße prüfen**: Bei sehr großen Dateien kann es zu Zeitüberschreitungen kommen
3. **URL prüfen**: Einige Websites blockieren den automatisierten Zugriff
4. **Internet prüfen**: Für den URL-Import ist eine Verbindung erforderlich
5. **Alternative ausprobieren**: Verwenden Sie Kopieren und Einfügen für Webinhalte

#### Leistungsprobleme

**Symptome:** Langsames Laden, Verzögerung, friert ein

**Lösungen:**
1. **Große Datenbank**: Alte Karten archivieren (Einstellungen → Daten → Archiv)
2. **Viele Bilder**: Bilder verlangsamen das Laden
3. **Systemressourcen**: Andere Apps schließen
4. **Datenbank neu erstellen**: Einstellungen → Daten → Neu erstellen (letzter Ausweg)

#### OCR funktioniert nicht

**Symptome:** OCR schlägt fehl oder liefert schlechte Ergebnisse

**Lösungen:**
1. **API-Schlüssel prüfen**: Gültig und mit Guthaben (Cloud-Anbieter)
2. **Überprüfen Sie die Bildqualität**: Klare, hochauflösende Bilder funktionieren am besten
3. **Sprache prüfen**: Richtige Sprache ausgewählt
4. **Alternativen Anbieter ausprobieren**: Einige funktionieren für bestimmte Inhalte besser
5. **Lokale OCR**: Verwenden Sie Tesseract, wenn Internetprobleme auftreten

#### llama.cpp antwortet nicht

**Symptome:** „Fehler beim Aufrufen von LLM“ oder Verbindung zu localhost:8080 abgelehnt

**Lösungen:**
1. **Überprüfen Sie, ob der Server läuft**: `curl http://localhost:8080/v1/models`
2. **Starten Sie den Server**: siehe [OCR-Setup](#ocr-optical-character-recognition) oben
3. **Kontextgröße zu klein**: Neustart mit „-c 16384“ oder höher
4. **Port wird verwendet**: Möglicherweise verwendet ein anderer Prozess Port 8080; Überprüfen Sie mit „lsof -i :8080“.
5. **Nicht genügend Speicher**: Verwenden Sie eine kleinere Quantisierung (Q3_K_M anstelle von Q4_K_M) oder ein kleineres Modell

#### Ollama startet nicht

**Symptome:** Die GLM-OCR Ollama-Laufzeit startet nicht

**Lösungen:**
1. **Ollama installieren**: Verwenden Sie die Schaltfläche „Herunterladen“ unter Einstellungen → OCR oder installieren Sie es von ollama.com
2. **Binärpfad prüfen**: Legen Sie den Ollama-Binärpfad fest, wenn er nicht am Standardspeicherort ist
3. **Linux-Berechtigungen**: Möglicherweise benötigen Sie „sudo“, um den Ollama-Dienst zu installieren oder auszuführen

### Hilfe bekommen

**Ressourcen:**
- **Dokumentation**: Suchen Sie im Ordner „docs/“ nach detaillierten Anleitungen
- **GitHub-Probleme**: Melden Sie Fehler und Funktionsanfragen
- **Community**: Nehmen Sie an Diskussionen teil und stellen Sie Fragen
- **Tastaturkürzel**: Drücken Sie in der App „?“, um schnell nachzuschlagen

**Debug-Modus:**
Aktivieren Sie die Debug-Protokollierung (Einstellungen → Erweitert → Debug-Modus), um Probleme zu beheben.

**Datenexport:**
Exportieren Sie Ihre Daten vor größeren Änderungen (Einstellungen → Backup → Exportieren)

### Erholung**Versehentliches Löschen:**
1. Backups prüfen (Einstellungen → Backup)
2. Stellen Sie die aktuelle Sicherung wieder her
3. Kontaktieren Sie den Support, wenn kein Backup verfügbar ist

**Beschädigte Datenbank:**
1. Daten sofort exportieren
2. Datenbank neu erstellen (Einstellungen → Daten → Neu erstellen)
3. Importieren Sie exportierte Daten
4. Überprüfen Sie alle vorhandenen Daten

**Verlorener Fortschritt:**
1. Überprüfen Sie Analytics → Export auf historische Daten
2. Bei Bedarf aus dem Backup wiederherstellen
3. Mit Cloud-Anbieter synchronisieren, falls aktiviert

---

## Glossar

**Extrahieren**: Ein aus einem Dokument extrahierter Inhalt, potenzielles Kartenmaterial

**Lernelement**: Jedes zu lernende Element (Lernkarte, Lückentext, Fragen und Antworten usw.)

**Warteschlange**: Alle zur Überprüfung geplanten Elemente, sortiert nach Priorität

**Überprüfungssitzung**: Eine Zeit des aktiven Abrufens und Bewertens von Karten

**FSRS**: Free Spaced Repetition Scheduler, moderner Algorithmus zur Optimierung des Review-Timings (FSRS-6 ist die aktuelle Version)

**Intervall**: Zeit zwischen den Bewertungen (z. B. 7 Tage)

**Stabilität**: Wie lange ein Speicher hält (FSRS-Metrik)

**Schwierigkeit**: Wie schwer ein Gegenstand für Sie ist, Skala 1–10 (FSRS-Metrik)

**Wiederauffindbarkeit**: Aktuelle Wahrscheinlichkeit des Rückrufs, 0–100 % (FSRS-Metrik)

**Gewünschte Bindung**: Zielbindungsrate (normalerweise 90 %)

**Vorschauintervall**: Funktion, die das nächste Überprüfungsdatum für jede Bewertungsoption anzeigt

**Lückentext**: Kartentyp zum Ausfüllen der Lücken

**Aussetzen**: Artikel vorübergehend aus Bewertungen ausblenden

**Kategorie**: Themenbereich für die Organisation

**Tag**: Benutzerdefiniertes Label für kategorieübergreifende Organisation

**Priorität**: Vom Benutzer festgelegte Wichtigkeit (0-100)

---

## Referenz zu Tastaturkürzeln

### Globale Verknüpfungen

| Verknüpfung | Aktion |
|----------|--------|
| `Strg/Befehl + K` | Befehlspalette öffnen |
| „Strg/Befehl + P“ | Befehlspalette öffnen (alternativ) |
| `Strg/Befehl + ,` | Öffnen Sie die Einstellungen |
| „Strg/Befehl + D“ | Gehen Sie zum Dashboard |
| „Strg/Befehl + Q“ | Zur Warteschlange gehen |
| „Strg/Befehl + R“ | Rezension starten |
| `Strg/Befehl + O` | Dokument öffnen |
| `Strg/Befehl + N` | Dokument importieren (alternativ) |
| `Strg/Befehl + /` | Tastaturkürzel anzeigen |
| `?` | Tastaturkürzel anzeigen (kein Modifikator) |

### Verknüpfungen für den Überprüfungsmodus

| Verknüpfung | Aktion |
|----------|--------|
| „Weltraum“ | Antwort anzeigen |
| `1` | Bewerten Sie „Noch einmal“ |
| `2` | Bewerten Sie „Schwer“ |
| `3` | Bewerten Sie „Gut“ |
| `4` | Bewerten Sie „Einfach“ |
| `Strg/Befehl + Eingabetaste` | Antwort anzeigen (Alternative) |
| `Strg/Befehl + 1/2/3/4` | Bewerten, ohne Antwort anzuzeigen |
| „Esc“ | Sitzung beenden |
| „Strg/Befehl + E“ | Aktuelle Karte bearbeiten (noch nicht implementiert) |
| „Strg/Befehl + D“ | Aktuelle Karte löschen (wird auch global für „Gehe zum Dashboard“ verwendet) |
| „Strg/Befehl + S“ | Karte sperren |
| `Strg/Befehl + H` | Kartengeschichte |

### Warteschlangenverknüpfungen

| Verknüpfung | Aktion |
|----------|--------|
| „Strg/Befehl + F“ | Fokussuche |
| `Strg/Befehl + A` | Alles auswählen |
| „Löschen“ | Ausgewählte löschen |
| „Strg/Befehlstaste + Klicken“ | Mehrfachauswahl |
| `Umschalt+Klick` | Bereichsauswahl |

### Verknüpfungen zum Dokument-Viewer

| Verknüpfung | Aktion |
|----------|--------|
| „Strg/Befehl + F“ | Im Dokument suchen |
| `Strg/Befehl + C` | Ausgewählten Text kopieren |
| „Strg/Befehl + E“ | Auszug aus Auswahl erstellen |
| `Strg/Befehl + H` | Auswahl hervorheben |
| `Strg/Befehl + +` | Vergrößern |
| `Strg/Befehl + -` | Herauszoomen |
| `Strg/Befehl + 0` | Zoom zurücksetzen |
| `F11` | Vollbild |

---

## FAQ

**F: Wie füge ich Newsletter zu Incrementum hinzu?**
A: Sie können Newsletter auf zwei Arten hinzufügen:
1. **Newsletter-Verzeichnis**: Klicken Sie auf RSS → Newsletter-Symbol (📬) → Durchsuchen und abonnieren Sie kuratierte Newsletter
2. **Direkte URL**: Kopieren Sie eine beliebige Newsletter-URL (Substack, Beehiiv usw.) → RSS → Feed hinzufügen → URL einfügen. Incrementum erkennt den RSS-Feed automatisch.

**F: Welche Newsletter-Plattformen werden unterstützt?**
A: Incrementum unterstützt RSS-Feeds von Substack-, Beehiiv-, Ghost-Blogs, Buttondown-, ConvertKit-, Revue-, Medium- und WordPress-Sites. Die meisten Newsletter veröffentlichen RSS-Feeds – suchen Sie auf der Website des Newsletters nach einem RSS-Link oder fügen Sie „/feed“ zur URL hinzu.

**F: Wie viele Karten sollte ich pro Tag überprüfen?**
A: Beginnen Sie mit 20–50 pro Tag. Passen Sie es an Ihren Zeitplan und Ihre Ziele an. Konsistenz ist wichtiger als Volumen.

**F: Wie viele Karten kann ich pro Tag erstellen?**
A: So viele Sie möchten, aber konzentrieren Sie sich auf Qualität statt Quantität. 10–20 gut gemachte Karten sind besser als 50 schlechte.

**F: Welche Bindungsrate sollte ich anstreben?**
A: 90 % ist der empfohlene Standardwert. Passen Sie den Wert auf 85 % an, wenn Sie zu viele Rezensionen haben, oder auf 95 % für kritisches Material.

**F: Kann ich Incrementum für Sprachen verwenden?**
A: Auf jeden Fall! Es eignet sich hervorragend für Vokabel-, Grammatik- und Satzkarten. Verwenden Sie Lückentextkarten für Grammatikmuster.

**F: Wie gehe ich mit mathematischen Gleichungen um?**
A: Verwenden Sie die LaTeX-Syntax in Karten. Verwenden Sie für OCR den Mathpix-Anbieter, um optimale Ergebnisse mit mathematischen Inhalten zu erzielen.

**F: Kann ich mit Anki synchronisieren?**
A: Ja! Konfigurieren Sie AnkiConnect unter Einstellungen → Integrationen → Anki für die bidirektionale Synchronisierung.

**F: Was ist der Unterschied zwischen Sperren und Löschen?**
A: Durch das Sperren werden Karten vorübergehend ausgeblendet (die Sperre kann aufgehoben werden). Durch das Löschen wird es dauerhaft entfernt (kann aus dem Backup wiederhergestellt werden).

**F: Wie oft sollte ich eine Bewertung abgeben?**
A: Täglich ist ideal. Wenn Sie Tage verpassen, sammeln sich die Karten an, gehen aber nicht „verloren“ – holen Sie einfach nach, wenn Sie können.

**F: Kann ich Incrementum auf mehreren Geräten verwenden?**
A: Noch nicht direkt, aber Sie können Daten über Dropbox/Google Drive synchronisieren oder die Browser-Erweiterung verwenden.

**F: Sind meine Daten privat?**
A: Ja! Alle Daten lokal gespeichert. Die Cloud-Synchronisierung erfolgt verschlüsselt. Es werden keine Daten an Server außer konfigurierten KI-Anbietern gesendet.

**F: Wie exportiere ich meine Karten?**
A: Einstellungen → Backup → Exportieren, oder verwenden Sie Anki Sync, um in das .apkg-Format zu exportieren.

---

## Änderungsprotokoll

Siehe [CHANGELOG.md](../CHANGELOG.md) für Versionsverlauf und Updates.

---

## Support & Community

- **Dokumentation**: [docs/](./)
- **GitHub**: [incrementum-tauri](https://github.com/melpomenex/incrementum-tauri)
- **Probleme**: [Fehler melden](https://github.com/melpomenex/incrementum-tauri/issues)
- **Diskussionen**: [Fragen stellen](https://github.com/melpomenex/incrementum-tauri/discussions)

---

**Viel Spaß beim Lernen! 🚀**

Gebaut mit ❤️ unter Verwendung von Tauri + React + Rust
