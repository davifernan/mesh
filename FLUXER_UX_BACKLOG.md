# BetterCord — Fluxer UX Backlog

Analysiert aus dem Fluxer-Frontend-Quellcode (`fluxer_app/`).
Nur Features die **im Frontend umsetzbar** sind — entweder rein clientseitig oder mit nativer Matrix-API-Unterstützung.

---

## Legende

- `[FE]` = Pure Frontend, kein Backend nötig
- `[MX]` = Braucht Matrix API (aber Matrix unterstützt es nativ)
- `[ ]` = offen · `[x]` = erledigt

---

## 🟢 SOFORT umsetzbar — Pure Frontend

---

### 1. Arrow-Up → letzte Nachricht editieren `[FE]`

**Was:** Wenn die Textarea leer ist und der User `Arrow Up` drückt, wird seine letzte eigene Nachricht sofort in den Edit-Modus versetzt.

**Wie:** Im Textarea-Keydown-Handler prüfen ob `key === "ArrowUp"` + textarea leer + kein Autocomplete offen. Dann letzte eigene Nachricht aus der Timeline suchen und `editEvent(lastMessage)` aufrufen.

**Fluxer-Referenz:** `src/hooks/useTextareaKeyboard.tsx` Zeile 162–179

**Aufwand:** ~2h

---

### 2. Escape-Key Chain `[FE]`

**Was:** Escape führt eine Prioritätskette aus:
1. Edit aktiv → Edit abbrechen, Textarea fokussieren
2. Reply aktiv → Reply abbrechen
3. Sonst → Channel als gelesen markieren + zur neuesten Nachricht scrollen

**Wie:** Im globalen Keydown-Handler (oder Textarea-Handler) die Reihenfolge prüfen. BetterCord hat bereits `stopReply()` und edit-cancel-Logik — nur zusammenführen.

**Fluxer-Referenz:** `src/hooks/useTextareaKeyboard.tsx` Zeile 130–160

**Aufwand:** ~2h

---

### 3. Draft Persistence per Channel `[FE]`

**Was:** Der aktuelle Textarea-Inhalt wird pro Channel in `localStorage` gespeichert. Beim Wechsel zurück in einen Channel wird der Draft automatisch wiederhergestellt.

**Wie:** Auf `onChange` des Textareas debounced `localStorage.setItem("draft_${roomId}", value)` schreiben. Beim Mounten des Textareas `localStorage.getItem(...)` auslesen und als Initialwert setzen.

**Fluxer-Referenz:** `src/hooks/useTextareaDraftAndTyping.tsx`

**Aufwand:** ~2h

---

### 4. Markdown Keybinds `[FE]`

**Was:** Keyboard-Shortcuts für Markdown-Formatierung während man im Textarea tippt:
- `Ctrl/Cmd+B` → `**fett**`
- `Ctrl/Cmd+I` → `*kursiv*`
- `Ctrl/Cmd+U` → `__unterstrichen__`
- `Ctrl/Cmd+Shift+S` → `~~durchgestrichen~~`

**Wie:** Im Textarea-Keydown-Handler die Kombination erkennen, aktuelle Selection um das Markdown-Delimiter wrappen (oder bei leerem Selection Delimiter einfügen und Cursor zwischen die Delimiter setzen).

**Fluxer-Referenz:** `src/hooks/useMarkdownKeybinds.tsx`

**Aufwand:** ~4h

---

### 5. Typing Indicator — Über der Textarea, mit Namen + Overflow `[FE]`

**Was:** Der Typing-Indicator wird komplett neu positioniert und verbessert:

**Position:** Direkt **über der Textarea-Eingabe** (floating pill, `position: absolute; bottom: 100%`) — nicht mehr irgendwo in der User-Liste oben rechts wo man ihn kaum sieht. So sieht man sofort wer gerade tippt, ohne den Blick vom Eingabefeld wegzubewegen.

**Namensanzeige mit intelligentem Overflow:**
- 1 Person: `"Alice tippt…"`
- 2 Personen: `"Alice und Bob tippen…"`
- 3 Personen: `"Alice, Bob und Charlie tippen…"`
- 4 Personen: `"Alice, Bob, Charlie und 1 weitere Person tippen…"`
- 5+ Personen: `"Alice, Bob, Charlie und 3 weitere Personen tippen…"`
- 10+ Personen: `"Mehrere Personen tippen…"` (Namen werden weggelassen)

**Animierte Dots:** 3 blinkende Punkte mit gestaffeltem Delay (0ms / 250ms / 500ms) — `opacity: 1 → 0 → 1`, `1s infinite`.

**Pill-Design:** Das bestehende Pill-CSS bleibt (`border-radius: var(--radius-2xl)`, `--background-tertiary` bg), aber jetzt **direkt am Input** verankert, nicht irgendwo oben.

**Ein/Ausblend-Animation:** Der Pill fährt von `translateY(8px), opacity: 0` auf `translateY(0), opacity: 1` wenn jemand anfängt zu tippen. Verschwindet sanft wenn alle aufgehört haben.

**Wie:**
- Typing-State aus dem Matrix-Client lesen: `mx.getRoom(roomId)?.currentState` oder der bereits vorhandene Typing-Hook in BetterCord
- Neue Komponente `TypingIndicatorPill.tsx` direkt im `RoomInputArea`-Container platzieren
- Container der Textarea braucht `position: relative`, der Pill bekommt `position: absolute; bottom: calc(100% + 4px); left: 0`
- Display-Namen der tippenden User via `room.getMember(userId)?.name` auflösen
- Overflow-Logik: erste 3 Namen anzeigen, Rest als `+ N weitere`
- CSS-Transition für mount/unmount: kurzer `translateY`-Slide

**Fluxer-Referenz:** `src/components/channel/TypingUsers.tsx` (Zeile 1–176) — dort ist die Text-Tier-Logik und Avatar-Stack zu sehen

**Aufwand:** ~3–4h

---

### 6. Member List: Online/Offline Farbunterschied `[FE]`

**Was:** In der rechten Member-Sidebar sollen Online- und Offline-User visuell klar unterscheidbar sein — nicht nur über den kleinen Status-Dot, sondern direkt über die Textfarbe des Namens:

- **Online / Idle / DND** → Name in `--text-primary` (helles Weiß-Ton, voll lesbar)
- **Offline / Unsichtbar** → Name in `--text-muted` (gedämpftes Grau, wie die aktuelle Standard-Textfarbe — der User "verschwindet" leicht)

So sieht man auf einen Blick wer aktiv ist, ohne jeden Status-Dot genau anschauen zu müssen. Das Offline-Grau wirkt dabei nicht "kaputt" — es ist genau die Farbe die aktuell überall für sekundären Text genutzt wird, also vertraut.

**Zusatz-Detail — Gruppen-Header:**
Die Sektion-Überschriften `ONLINE — 12` / `OFFLINE — 34` bekommen ihre Zahl in der passenden Farbe:
- ONLINE-Zahl: `--status-online` (grün)
- OFFLINE-Zahl: `--text-muted` (grau)

**Wie:**
- Im Member-List-Item-Komponenten den `presence`-Status des Users lesen (`user.presence === 'online' || 'unavailable'` → online-Farbe, sonst muted)
- CSS-Klasse oder inline-style je nach Presence: `color: var(--text-primary)` vs `color: var(--text-muted)`
- Transition `color 200ms ease` damit der Wechsel sanft passiert wenn jemand online/offline geht
- Für die Gruppen-Header: Zahl-Span bekommt entsprechende Farb-Variable

**CSS-Snippet:**
```css
.memberName[data-online="true"]  { color: var(--text-primary); }
.memberName[data-online="false"] { color: var(--text-muted);   }
.memberName { transition: color 200ms ease; }
```

**Aufwand:** ~1–2h (Member-Sidebar existiert bereits in BetterCord — direkt umsetzbar)

---

### 7. Character Counter `[FE]`

**Was:** Unter der Textarea erscheint ein Zähler `aktuell / max` — aber **nur wenn man über 80% der maximalen Länge ist**. Darunter ist er unsichtbar.

**Wie:** Eigene kleine Komponente unter der Textarea. `characterCount / MAX_MESSAGE_LENGTH * 100 >= 80` → sichtbar. Farbe wechselt zu Rot wenn bei 100%.

**Fluxer-Referenz:** `src/components/channel/MessageCharacterCounter.tsx`

**Aufwand:** ~1h

---

### 7. Reaction Count Animation `[FE]`

**Was:** Wenn eine Reaktion hinzugefügt oder entfernt wird, gleitet die Zahl sanft nach oben (bei Erhöhung) oder nach unten (bei Senkung) — nicht einfach abrupt wechseln.

**Wie:** Für jede Reaction-Komponente den `prevCount` tracken. Bei Änderung: `key={count}` auf einem `motion.div` mit `initial={{ y: direction * 20, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}`. CSS-Alternative ohne Framer: `@keyframes slideUp/slideDown`.

**Fluxer-Referenz:** `src/components/channel/MessageReactions.tsx` Zeile 71–163

**Aufwand:** ~2h

---

### 8. New Messages Bar (oben sticky) + NEW-Divider `[FE]`

**Was:**
- **Bar oben:** Wenn ungelesene Nachrichten oberhalb des aktuellen Scrollbereichs liegen, erscheint ein sticky Banner: `"N neue Nachrichten seit [Uhrzeit]"` mit einem `✓ Als gelesen markieren` Button.
- **Divider im Stream:** Eine `——— NEU ———` Trennlinie wird an der Position der ältesten ungelesenen Nachricht in den Message-Stream eingefügt.

**Wie:** Unread-Count aus `roomToUnread`-Atom lesen. `oldestUnreadEventId` tracken. Beim Rendern der Timeline an der passenden Position einen Divider-Slot einfügen. Die sticky Bar bekommt `position: sticky; top: 0` und verschwindet wenn der User ans Ende scrollt.

**Fluxer-Referenz:**
- `src/components/channel/NewMessagesBar.tsx`
- `src/components/channel/UnreadDividerSlot.tsx`

**Aufwand:** ~1 Tag

---

### 9. "Jump to Present" Bar `[FE]`

**Was:** Wenn der User in der History nach oben gescrollt hat (ältere Nachrichten), erscheint am unteren Rand ein Banner: `"Du siehst ältere Nachrichten · Zu aktuellen Nachrichten springen"`.

**Wie:** `hasMoreAfter`-State aus der Timeline tracken (BetterCord hat bereits "load more"-Logik). Wenn `!isAtBottom && hasMoreAfter` → Bar anzeigen. Klick → ans Ende springen.

**Fluxer-Referenz:** `src/components/channel/Messages.tsx` Zeile 662–690

**Aufwand:** ~4h

---

### 10. Channel Hover Affordances `[FE]`

**Was:** Beim Hovern über ein Channel-Item in der Sidebar erscheinen rechts kleine Action-Icons:
- `⚙` Channel-Settings (nur wenn `canManageRoom`)
- `+` Neuen Channel erstellen (nur auf Category-Items, wenn `canManageRoom`)

Die Icons sind standardmäßig unsichtbar (`opacity: 0`) und werden auf `opacity: 1` bei Hover des Channel-Items.

**Wie:** Im Channel/Room-Item-Komponenten (SidebarItem) beim Hover-State die Icon-Buttons einblenden. Permission-Check: Matrix `mx.getRoom(roomId).currentState.maySendStateEvent(...)`.

**Fluxer-Referenz:** `src/components/layout/ChannelItem.tsx` Zeile 665–742

**Aufwand:** ~1 Tag

---

### 11. Create Channel Modal `[FE]`

**Was:** Ein neues Modal zum Erstellen eines Channels mit 3 Typen:
1. **Text** (Standard-Matrix-Room)
2. **Voice** (Room mit `type: 'm.voice'` oder ähnlich)
3. **Ankündigungs-/Link** (Room mit custom state event)

Nach der Erstellung wird automatisch zum neuen Channel navigiert.

**Wie:** Neues `CreateChannelModal.tsx` mit `RadioGroup` für den Typ, Name-Input, optional `parentId` (für Space-Hierarchy). Matrix `mx.createRoom(...)` mit entsprechenden Optionen. Nach Success: `navigateRoom(result.room_id)`.

**Fluxer-Referenz:** `src/components/modals/ChannelCreateModal.tsx`, `src/utils/modals/ChannelCreateModalUtils.tsx`

**Aufwand:** ~1 Tag

---

### 12. Create Category Modal `[FE]`

**Was:** Minimales Modal zum Erstellen einer Kategorie (in Matrix: ein Space oder ein speziell markierter Room als "Kategorie").

**Wie:** Einfaches Modal mit Name-Input. Matrix-seitig als Space-Room mit `is_direct: false` und einem `m.space.parent`-Verweis erstellen.

**Fluxer-Referenz:** `src/components/modals/CategoryCreateModal.tsx`

**Aufwand:** ~2h

---

### 13. Mark All Read Shortcuts `[FE]`

**Was:**
- `Escape` → Aktuellen Channel als gelesen markieren + zum Ende scrollen
- `Shift+Escape` → Alle Channels des aktuellen Space/Servers als gelesen markieren
- `Ctrl+Shift+E` → Obersten ungelesenen Eintrag im Inbox markieren (wenn Inbox existiert)

**Wie:** Global-Keydown-Handler oder über das bestehende Keyboard-Shortcut-System. Matrix `mx.sendReadReceipt(latestEvent)` für einzelne Channel. Für "alle lesen": Alle Rooms des Space iterieren und jeweils das letzte Event ACK-en.

**Fluxer-Referenz:** `src/lib/KeybindManager.tsx` Zeile 611–657

**Aufwand:** ~4h

---

### 14. Pin: Shift+Click Bypass `[FE]`

**Was:** Normalerweise erscheint beim Pinnen einer Nachricht ein Bestätigungs-Modal. Wenn der User beim Klick auf "Pin" die Shift-Taste gedrückt hält, wird das Modal übersprungen und direkt gepinnt.

**Wie:** Im Pin-Action-Handler `event.shiftKey` prüfen. Wenn `true` → direkt `mx.sendStateEvent(...)` ohne Modal-Zwischenschritt.

**Fluxer-Referenz:** `src/components/channel/MessageActionUtils.tsx` Zeile 401–436

**Aufwand:** ~1h

---

### 15. Message Forward Modal `[FE]`

**Was:** Aus der Message-Action-Bar heraus (oder Rechtsklick-Menü) kann eine Nachricht an einen anderen Channel oder DM weitergeleitet werden. Ein Modal öffnet sich mit einer Channel-/DM-Suche.

**Wie:** Neues `ForwardMessageModal.tsx`. Zeigt eine durchsuchbare Liste von Rooms/DMs. Bei Auswahl: Nachrichteninhalt als neue Nachricht in den Ziel-Channel senden (mit optionalem "Weitergeleitet von"-Hinweis).

**Fluxer-Referenz:** `src/components/modals/ForwardModal.tsx`

**Aufwand:** ~1 Tag

---

### 16. Message Bookmark / Gespeicherte Nachrichten `[FE]`

**Was:** Nachrichten können über die Action-Bar mit einem Lesezeichen versehen werden. Gespeicherte Nachrichten sind in einem eigenen Panel zugänglich.

**Wie:** Bookmarks in Matrix `account_data` unter `app.bettercord.bookmarks` (Array von `{eventId, roomId, timestamp}`) speichern. Max ~200 Einträge. UI: ein Icon in der Action-Bar (gefüllt wenn bereits gemerkt), ein Panel/Tab in der Sidebar.

**Fluxer-Referenz:** `src/components/channel/MessageActionUtils.tsx` Zeile 272–288

**Aufwand:** ~1 Tag

---

### 17. AddGuild Modal: Live Initials Preview + Icon Upload `[FE]`

**Was:** Verbesserung des bestehenden `CreateCommunityModal`:
- Der Community-Icon-Placeholder zeigt sofort die **Initialen des eingegebenen Namens** (dynamisch, während man tippt)
- Font-Size der Initialen passt sich an die Länge an (1 Buchstabe = groß, 3 Buchstaben = klein)
- **Icon-Upload** Button → File-Picker → Bild-Crop (quadratisch) → Preview

**Wie:**
- Initialen: `getInitials(name)` berechnen, in das Placeholder-div rendern. CSS `font-size` via `clamp()` oder `cqi` Units.
- Upload: `<input type="file" accept="image/*">` + Canvas-basiertes Cropping (oder `react-image-crop` Library).
- 40 zufällige Placeholder-Namen für das Name-Input (wie Fluxer).

**Fluxer-Referenz:** `src/components/modals/AddGuildModal.tsx` Zeile 139–330

**Aufwand:** ~2 Tage

---

## 🟡 MEDIUM — Braucht Matrix API (Matrix unterstützt es)

---

### 18. Quick Switcher (Ctrl+K) `[MX]`

**Was:** Das wichtigste UX-Feature. Ein Modal-Overlay für schnelle Navigation zu allem:
- Rooms / Spaces / DMs
- User (DM öffnen)
- Settings-Seiten
- Aktionen (`>` Prefix: Theme wechseln, Reduced Motion, Compact Mode)

**Prefix-Filter:**
- `@` → User/DMs
- `#` → Text-Rooms
- `!` → Voice-Rooms
- `*` → Spaces/Communities
- `>` → Quick Actions (Theme, Layout, etc.)

**Default-State (kein Query):** Letzte 8 besuchte Rooms + 8 ungelesene Rooms, sortiert nach Aktivität.

**Fuzzy Matching:** `match-sorter` Library.

**Keyboard:** Arrow Up/Down navigiert, Enter/Tab bestätigt, Escape schließt.

**Wie:**
- Neues `QuickSwitcherModal.tsx` + `QuickSwitcherStore.ts` (Jotai Atom)
- Kandidaten aus `allRoomsAtom`, `mDirectAtom`, `roomToUnreadAtom` aufbauen
- `useHotkeys('ctrl+k', ...)` für den Trigger
- Mobile: Bottom Sheet statt Modal

**Fluxer-Referenz:**
- `src/stores/QuickSwitcherStore.tsx` (~1400 Zeilen)
- `src/components/quick_switcher/QuickSwitcherModal.tsx`

**Aufwand:** ~3–4 Tage

---

### 19. Keyboard Shortcuts System `[MX]`

**Was:** ~20 essentielle Shortcuts (Subset von Fluxers 50):

| Shortcut | Aktion |
|---|---|
| `Ctrl+K` | Quick Switcher |
| `Ctrl+,` | User Settings öffnen |
| `Alt+↑` / `Alt+↓` | Vorheriger/Nächster Channel |
| `Alt+Shift+↑` / `Alt+Shift+↓` | Vorheriger/Nächster ungelesener Channel |
| `Ctrl+[` / `Ctrl+]` | Navigation zurück/vor (Browser-History) |
| `Ctrl+Shift+M` | Mikrofon muten/unmuten (global) |
| `Ctrl+Shift+D` | Deafen (global) |
| `Escape` | Channel lesen / Edit abbrechen |
| `Shift+Escape` | Server lesen |
| `Ctrl+F` | Suche im Channel |
| `Ctrl+B/I/U` | Markdown Bold/Italic/Underline |
| `PageUp/PageDown` | Chat scrollen |

**Wie:**
- Zentrales `KeybindStore` (Jotai) mit `Map<Action, KeyCombo>`
- `useHotkeys` Library oder eigener `document.addEventListener('keydown', ...)` Handler
- Settings-Tab "Tastenkürzel" zum Anzeigen (zunächst read-only, später anpassbar)

**Fluxer-Referenz:**
- `src/stores/KeybindStore.tsx`
- `src/lib/KeybindManager.tsx`

**Aufwand:** ~2–3 Tage

---

### 20. User Profile Popup `[MX]`

**Was:** Klick auf einen Username/Avatar in der Chat-Timeline öffnet eine floating Karte mit:
- Avatar + Banner (falls in Matrix-Profil vorhanden)
- Display Name + Matrix-ID
- Präsenz-Status (online/offline/idle)
- Bio (aus Matrix account_data)
- "Nachricht senden" Button → öffnet DM
- "Profil ansehen" Link → öffnet vollen Profil-Modal

**Skeleton:** Sofort einen Platzhalter zeigen, dann Profil-Daten nachladen.

**Wie:**
- `mx.getProfileInfo(userId)` für Name + Avatar
- `mx.getUser(userId)?.presence` für Status
- Floating UI via `@floating-ui/react` (bereits im Projekt vorhanden)
- Neues `UserProfilePopout.tsx` + `UserProfileCard.tsx`

**Fluxer-Referenz:**
- `src/components/popouts/UserProfilePopout.tsx`
- `src/components/profile/profile_card/*`

**Aufwand:** ~1 Woche

---

### 21. Member List Sidebar (rechte Spalte) `[MX]`

**Was:** Eine optionale rechte Sidebar (270px) die alle Mitglieder des aktuellen Rooms zeigt, gruppiert nach:
- Online (grüner Dot)
- Abwesend/Idle
- Offline

Jedes Member-Item: Avatar (mit Präsenz-Dot), Display Name, Matrix-ID.

Klick auf ein Member → öffnet User Profile Popup.

**Toggle:** Ctrl+U oder ein Button im Channel-Header.

**Wie:**
- Matrix `room.getJoinedMembers()` für die Liste
- Gruppierung nach `user.presence`
- Virtual Scroll (z.B. `@tanstack/react-virtual` — bereits im Projekt) für große Räume
- State: `isMembersOpen` Atom, persistent in localStorage

**Fluxer-Referenz:**
- `src/stores/MemberSidebarStore.tsx`
- `src/hooks/useMemberListSubscription.tsx`

**Aufwand:** ~1 Woche

---

### 22. Invite Modal — verbesserte Version `[MX]`

**Was:** Verbesserung des bestehenden Einlade-Flows mit:
- **Normal View:** Link kopieren Button + "Advanced" Toggle
- **Advanced View:** Ablaufzeit wählen (30min / 1h / 6h / 1Tag / 7Tage / Nie) + Max-Uses wählen (1/5/10/25/50/100/Unbegrenzt)
- Generierter Link wird sofort angezeigt (Matrix `mx.createRoomAlias(...)` oder invite link)
- "Neuen Link erstellen" regeneriert mit neuen Einstellungen

**Wie:**
- Matrix hat native Einlade-Links via `mx.makeRoomAliasOrId()` — aber keine Ablaufzeit auf Protokoll-Ebene
- Ablaufzeit + Max-Uses als custom state event (`app.bettercord.invite_settings`) speichern, server-seitig optional validieren
- Minimal: nur Copy-Link + Einfache Optionen ohne server-seitiges Enforcement

**Fluxer-Referenz:** `src/components/modals/InviteModal.tsx`

**Aufwand:** ~3 Tage

---

### 23. Custom Status (Emoji + Text + Ablaufzeit) `[MX]`

**Was:** Unter dem eigenen Avatar-Bereich (User Area) kann man einen Custom Status setzen:
- Emoji (Unicode oder Custom) + Text (max 128 Zeichen)
- Optionale Ablaufzeit: 30min / 1h / 4h / Heute / Diese Woche / Nie

Der Status ist für andere sichtbar (in Profile Cards, Member List).

**Wie:**
- Speichern in Matrix `mx.setAccountData('app.bettercord.status', {emoji, text, expiresAt})`
- Client-seitiger Expiry-Timer (setTimeout) der den Status nach Ablauf nullt
- Anzeigen: `mx.getUser(userId).accountData` lesen (oder via Presence-Event broadcasten)
- `CustomStatusModal.tsx` für das Eingabe-UI + Emoji-Picker

**Fluxer-Referenz:**
- `src/components/modals/CustomStatusModal.tsx`
- `src/components/common/custom_status_display/CustomStatusDisplay.tsx`
- `src/hooks/usePresenceCustomStatus.tsx`

**Aufwand:** ~3 Tage

---

### 24. Ban Member Modal (verbessert) `[MX]`

**Was:** Beim Kicken/Bannen eines Mitglieds öffnet sich ein Modal mit:
- Bestätigung + Warnung
- **Grund** eingeben (optional, max 512 Zeichen)
- **Nachrichten löschen:** Nicht löschen / Letzte 24h / Letzte 7 Tage (falls Feature verfügbar)
- Bestätigungs-Button in Danger-Rot

**Wie:**
- Matrix `mx.kick(roomId, userId, reason)` bzw. `mx.ban(roomId, userId, reason)`
- Nachrichtenlöschung via `mx.redactEvent()` für alle Events des Users innerhalb des Zeitfensters
- `ConfirmModal` mit Grund-Input + Zeitraum-Select

**Fluxer-Referenz:** `src/components/modals/BanMemberModal.tsx`

**Aufwand:** ~1 Tag

---

### 25. Nagbar System `[MX]`

**Was:** Dünne Bannerleisten ganz oben in der App für wichtige System-Hinweise:

Sinnvolle Fluxer-Nagbars für BetterCord:
- **E-Mail nicht verifiziert** (falls Homeserver das meldet)
- **Desktop-Benachrichtigungen erlauben** (wenn `Notification.permission === 'default'`)
- **Verbindungsproblem** (wenn Matrix-Client disconnected)
- **Neue BetterCord-Version verfügbar** (wenn Service Worker Update detected)

Mehrere Nagbars stacken vertikal. Jede hat ein ✕ zum Dismissen (persistent in localStorage).

**Wie:**
- `NagbarStore` (Jotai) mit Array von aktiven Nagbars
- `<NagbarContainer>` über dem App-Content
- Conditions prüfen beim App-Start: `Notification.permission`, Service-Worker-Update-Event, Matrix connection state

**Fluxer-Referenz:**
- `src/stores/NagbarStore.tsx`
- `src/components/layout/app_layout/NagbarContainer.tsx`

**Aufwand:** ~2 Tage

---

## Prioritäts-Empfehlung

```
Woche 1 — Kleine Quick Wins (alle [FE], 1-2h pro Stück):
  → Arrow-Up editieren (#1)
  → Escape-Key Chain (#2)
  → Draft Persistence (#3)
  → Markdown Keybinds (#4)
  → Typing Indicator Tiers (#5)
  → Pin Shift+Click Bypass (#14)

Woche 2 — Sichtbare UX-Verbesserungen:
  → New Messages Bar + Divider (#8)
  → Jump to Present Bar (#9)
  → Channel Hover Affordances (#10)
  → Reaction Count Animation (#7)

Woche 3–4 — Große Features:
  → Quick Switcher Ctrl+K (#18)  ← größter Impact
  → Keyboard Shortcuts System (#19)

Woche 5+ — Social Features:
  → User Profile Popup (#20)
  → Member List Sidebar (#21)
  → Custom Status (#23)
```

---

*Erstellt nach Fluxer-Frontend-Analyse — Stand: März 2026*
*Fluxer-Quellcode: `/Users/davifernandesrezende/WebstormProjects/voicechat/fluxer/fluxer_app/src/`*
