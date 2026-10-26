# Randimeghívó 💌

Magyar nyelvű, mobilra tervezett vicces randimeghívó-oldal. A meghívó készítője személyes linket generál, a címzett az „Igen” után dátumot és programot választ. A válasz a Cloudflare D1 adatbázisba kerül. Az oldal nem használ e-mail-értesítéseket.

## Telepítés

A felület statikus HTML, de a megosztott meghívólinkek és a központi mentés **Cloudflare Pages Functions** segítségével működnek. A projektet Cloudflare Pages-re kell telepíteni; a GitHub Pages önmagában nem futtatja a \`functions/api/invites.js\` végpontot.

1. Cloudflare-ben hozz létre egy D1 adatbázist.
2. Futtasd rajta a repó gyökerében található \`schema.sql\` fájl SQL-parancsait.
3. A Cloudflare Pages projektben add hozzá az adatbázist D1 bindingként, **\`DB\`** néven.
4. Telepítsd újra a projektet. A \`functions/api/invites.js\` a \`/api/invites\` végpontot szolgálja ki.

## Funkciók

- Személyre szabott meghívólink készítése.
- Mozgó, vicces feliratokat mutató „Nem” gomb, majd egyértelmű kilépési lehetőség.
- Dátum, időpont, randiötlet, helyszín és opcionális megjegyzés kiválasztása.
- A válasz formázott szövegként tárolódik az adatbázisban.
- A végén megjelenik egy szépen megfogalmazott visszaigazoló üzenet, amely másolható vagy megosztható.
- Előnézeti mód. Az előnézet nem ment adatot.

## Fontos

Ha a D1 nincs beállítva, a valódi meghívóküldés és válaszrögzítés nem működik. A felület hibaüzenetet jelenít meg, és nem állítja, hogy a választ elmentette.