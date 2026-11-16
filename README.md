# My Vacation Manager

Deine persönliche Urlaubsverwaltung. Läuft im Browser, auf dem Handy als App (PWA) und auf dem Laptop. Die App selbst ist auf Englisch, diese Anleitung auf Deutsch.

## Was die App kann

- Zwei getrennte Konten: Resturlaub aus dem Vorjahr und Urlaub aus dem aktuellen Jahr.
- Resturlaub wird zuerst verbraucht, aber nur für Urlaubstage bis zum 31. März (Frist einstellbar). Was danach übrig ist, wird als verfallen markiert. Gelöscht wird nie etwas.
- Anteiliger Urlaub im Eintrittsjahr: pro vollem Monat, aufgerundet (einstellbar).
- Halbe Tage, z. B. Heiligabend.
- Kalender mit Feiertagen aller Bundesländer, Standard Baden-Württemberg.
- Antrag mit Unterschrift (Finger, Stift oder Maus), PDF mit Unterschrift, E-Mail an deinen Chef.
- Status selbst setzen: Draft, Sent/Pending, Approved, Rejected, Withdrawn.
- Historie pro Jahr, manuelle Korrekturen mit Begründung (Audit-Log), Backup als Datei.

## 1. Lokal starten

Doppelklick auf `starten.bat`. Beim ersten Mal installiert sie die Pakete, danach öffnet sich der Browser mit `http://localhost:5173`.

Ohne weitere Einrichtung speichert die App alles **in diesem Browser auf diesem Gerät**. Das reicht zum Ausprobieren. Für Handy und Laptop gemeinsam brauchst du Supabase (Schritt 2) und Vercel (Schritt 4).

E-Mail ohne Einrichtung: Beim Senden lädt die App das unterschriebene PDF herunter und öffnet einen fertigen E-Mail-Entwurf in deinem Mailprogramm. Du hängst nur noch das PDF an und schickst ab.

## 2. Supabase einrichten (Datenbank und Login)

Dauer etwa 15 Minuten. Kostenloser Plan reicht.

1. Auf [supabase.com](https://supabase.com) ein Konto anlegen und **New project** wählen. Region: Frankfurt (eu-central-1). Datenbank-Passwort gut aufheben.
2. Links **SQL Editor**, dann **New query**. Den kompletten Inhalt von `supabase/schema.sql` einfügen und **Run** klicken. Damit entstehen die Tabellen und die Zugriffsregeln (Row Level Security: jeder sieht nur seine eigenen Daten).
3. **Project Settings > API**: Dort stehen die **Project URL** und der **anon / publishable key**. Beide sind für den Browser gedacht und dürfen in die App.
4. Im Ordner `app` die Datei `.env.example` kopieren und die Kopie `.env.local` nennen. Eintragen:
   ```
   VITE_SUPABASE_URL=https://dein-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=dein-anon-key
   ```
5. App neu starten. Jetzt kommt ein Login. Einmal **Create account** mit deiner E-Mail, Bestätigungsmail anklicken, anmelden.
6. Danach in Supabase unter **Authentication > Sign In / Providers** die Option **Allow new users to sign up** ausschalten. Dann kann sich niemand sonst registrieren.
7. Deine Testdaten vom lokalen Modus mitnehmen: vorher in der App unter **Settings > Data and backup > Download backup** sichern und nach dem Login mit **Restore backup** einspielen.

Hinweis: Kostenlose Supabase-Projekte können pausieren, wenn längere Zeit niemand zugreift. Im Dashboard lassen sie sich mit einem Klick wieder starten.

## 3. Resend einrichten (E-Mail direkt aus der App)

1. Konto auf [resend.com](https://resend.com) anlegen.
2. **API Keys > Create API Key**, Berechtigung "Sending access". Den Schlüssel nur in `.env.local` bzw. bei Vercel eintragen, nie in den Chat und nie in den Code:
   ```
   RESEND_API_KEY=re_...
   ```
3. Wichtig: Ohne eigene Domain liefert Resend nur an die E-Mail-Adresse deines Resend-Kontos. Zum Testen reicht das. Damit dein Chef die Mail bekommt, brauchst du eine eigene Domain (kostet ein paar Euro im Jahr), die du unter **Domains** in Resend bestätigst. Dann:
   ```
   RESEND_FROM=Chris <urlaub@deine-domain.de>
   ALLOWED_RECIPIENTS=chef@firma.de
   ```
   `ALLOWED_RECIPIENTS` ist ein Schutz: Die App darf dann nur an diese Adresse senden.
4. Ehrliche Einschätzung: Wenn du keine Domain willst, ist der eingebaute Weg (PDF plus Mail-Entwurf) völlig in Ordnung. Er kostet einen Klick mehr.

Der Schlüssel liegt nur auf dem Server (`api/send-request.ts`). Der Browser bekommt ihn nie zu sehen. Senden darf nur, wer in der App angemeldet ist.

## 4. Veröffentlichen mit Vercel

1. Konto auf [github.com](https://github.com) und [vercel.com](https://vercel.com) anlegen (bei Vercel mit GitHub anmelden).
2. Den Ordner `app` als **privates** GitHub-Repository hochladen. Die Datei `.env.local` wird dabei automatisch ausgelassen (steht in `.gitignore`).
3. In Vercel **Add New > Project**, das Repository wählen. Vercel erkennt Vite von selbst.
4. Unter **Environment Variables** eintragen:
   - `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (wie oben)
   - `SUPABASE_URL` und `SUPABASE_ANON_KEY` (dieselben Werte, für die E-Mail-Funktion)
   - `RESEND_API_KEY`, `RESEND_FROM`, `ALLOWED_RECIPIENTS`
5. **Deploy**. Du bekommst eine Adresse wie `https://my-vacation-manager.vercel.app`.
6. In Supabase unter **Authentication > URL Configuration** diese Adresse als **Site URL** eintragen.

## 5. Als App aufs Handy und den Laptop

Geht erst mit der Vercel-Adresse (Apps brauchen HTTPS).

- **iPhone:** In Safari öffnen, Teilen-Symbol, **Zum Home-Bildschirm**.
- **Android:** In Chrome öffnen, Menü, **App installieren**.
- **Windows:** In Edge oder Chrome öffnen, in der Adresszeile auf das Installieren-Symbol klicken.

## Testen

- Automatische Tests (42 Stück, u. a. FIFO, 31. März, halbe Tage, Jahreswechsel, PDF, E-Mail-Funktion):
  ```
  npm test
  ```
- Datum simulieren, um die Frist zu prüfen: App mit `?today=2027-04-01` öffnen, z. B. `http://localhost:5173/?today=2027-04-01`. Oben erscheint ein gelber Hinweis. Zurück mit `?today=reset`.
- Auf der Startseite gibt es **Try with demo data first** mit einem Beispielmitarbeiter.

## Deutsch später hinzufügen

Alle Texte stehen in `src/i18n/en.ts`. Für Deutsch die Datei nach `de.ts` kopieren, übersetzen und in `src/i18n/index.ts` eintragen. Am restlichen Code ändert sich nichts.

## Aufbau

```
app/
  api/send-request.ts      E-Mail-Funktion (Server, Resend)
  supabase/schema.sql      Datenbank und Zugriffsregeln
  src/domain/              Rechenlogik: Feiertage, Arbeitstage, Konten, FIFO, Frist
  src/data/                Speichern: lokal (IndexedDB) oder Supabase
  src/pages/               Seiten: Dashboard, Kalender, Antrag, Historie, Einstellungen
  src/components/          Bausteine: Kalender, Unterschrift, Saldo-Block
  src/lib/                 PDF, Versand, Backup
  src/i18n/en.ts           Alle englischen Texte
```
