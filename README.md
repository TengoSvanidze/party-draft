# Party Draft

Private development snapshot of the Party Draft phone party game.

## Run

Requires Node.js 22 or later. No dependencies need installing.

```sh
cd outputs/party-draft-app
node server.mjs
```

Open http://localhost:4173/ in your browser. On Windows, you can also double-click `outputs/party-draft-app/Start-Party-Draft.cmd`.

## Saved version: v0.1.0-playtest — 2026-10-02

- Six rounds: Planner, Defender, Attacker, Boyfriend, Best Friend, and Who Attacks You.
- Three drafters and one human narrator; each drafter starts with €1,000.
- 15-second auctions and 30-second mystery choices.
- Narrator chooses and locks all six mystery boxes before starting.
- No bids: assign at starting price to the next eligible player after the previous buyer, beginning with the first drafter for the opening purchase.
- Skip filled slots and unaffordable purchases; unfilled slots remain X.
- Round headers, lineups, voting, tie-breaks, result cards, and rematches.
- User-selected character photo replacements, orange and black interface.
- English with Georgian translation placeholders for the owner to complete.

The runnable app and its guide are in `outputs/party-draft-app/`. Current content is in `outputs/mcu-six-position-pack.json`; photos and source metadata are in `outputs/assets/`. Other documents and mockups in `outputs/` preserve the design history and may describe earlier versions.

Live room state and session data are created locally under `work/` and are excluded from Git.

## Verify

```sh
cd outputs/party-draft-app
node --test test/*.test.mjs
```

33 automated tests passed for this snapshot. Browser verification confirmed the round header and automatic assignment after the auction timer expired.
