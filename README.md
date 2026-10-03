# Tic Tac Toe Console Game

[![Play in your browser](https://img.shields.io/badge/Play-in%20your%20browser-2ea44f)](https://danielstephenson.dev/play/tic-tac-toe-console-game)

This application allows the user to play Tic Tac Toe against the computer.

## Play in your browser
The game can be played at <https://tic-tac-toe-java.play.danielstephenson.dev>, and is listed with
the other browser games at <https://danielstephenson.dev/play>. It runs the same Java classes in the
browser with [CheerpJ](https://cheerpj.com) (Leaning Technologies), loaded from CheerpJ's official
CDN under its Community License.

The browser build lives in `web/`:

- `web/java/BrowserMain.java` is a browser-only entry point. CheerpJ offers no interactive
  standard input, so it replaces `System.in` and `System.out` with streams backed by two JavaScript
  functions on the page, then plays `TicTacToe` unchanged, offering a new game after each result.
  It does not start usage reporting, so the browser build never reports.
- `web/index.html` shows the game's output, and a text field with an Enter button feeds each move
  to `System.in`.
- `web/build.sh` compiles `src/` and `BrowserMain` with `--release 8` (CheerpJ's default Java
  runtime is Java 8) into `build/web/tic-tac-toe.jar`, and copies the page next to it.

To try it locally, run `./web/build.sh`, serve `build/web` (for example with
`python3 -m http.server 8000 --directory build/web`) and open <http://localhost:8000>.

The `Browser build` workflow (`.github/workflows/browser.yml`) builds and checks the site on every
pull request and push, and deploys it to arcade, versioned as `version.txt` plus the commit, on a
manual run, or on a push to `master` when the repository variable `ARCADE_ENABLED` is `true`.

## Requirements
A JDK is required, not just a JRE, since the sources are compiled with `javac`. Java 8
or newer is needed, because the vendored usage-reporting client (`src/TraceClient.java`)
uses lambdas. No build system, and no third-party dependency, is used by this project.

## Building
The sources live flat in `src/` in the default package and are compiled with a
single command:

```
javac -d out src/*.java
```

The `out/` directory is ignored by `.gitignore`, so compiled classes are never
committed.

The same command is run by the GitHub Actions workflow in `.github/workflows/ci.yml`
on every push to `master` and every pull request, followed by three bounded games played
from piped input: a smoke test, one that checks an uppercase move is played in the
right column and that malformed moves are rejected rather than crashing the game, and
one whose input runs out mid-game, which must end cleanly.

## Running
The entry point is the `Driver` class:

```
java -cp out Driver
```

## How to play
The player is `X` and always moves first; the computer is `O` and picks an unoccupied
space at random. The board is printed before every prompt:

```
   A   B   C
1 [ ] [ ] [ ]
2 [ ] [ ] [ ]
3 [ ] [ ] [ ]
```

A move is entered as a column letter followed by a row number, with no space between
them — `a1` is the top-left space, `b2` the center, `c3` the bottom-right. Column
letters are accepted in either case, so `B2` and `b2` are the same move.

Anything else — a single character, a letter other than `a`-`c`, a row other than
`1`-`3`, or extra characters such as `a1x` — is rejected: `That is not a valid move.
Enter a column letter and a row number, like a1 or B2.` is printed and the board is
shown again. If an occupied space is chosen, `That space is taken! Choose another one.`
is printed and the board is shown again.

The game ends as soon as a line of three is completed or the board fills, and one of
`You won!`, `You lost!`, or `It was a tie!` is printed with the final board.

## Known limitations
- No quit command is offered; a game in progress is left by interrupting the process,
  or by ending input — `Ctrl+D`, or a piped script running out of moves — which prints
  `Input ended before the game was finished.` and exits normally. A game left that way
  has no result, so no `game-finished` usage event is sent for it.
- No automated test suite exists; changes are verified by compiling and playing. The
  CI workflow only checks that the sources compile, that a game runs to a result
  line, how move input is parsed, and that running out of input ends a game cleanly —
  not which moves the computer makes or who wins.

## Usage reporting
Usage reporting is on by default: each run sends a `startup` event carrying the game's name and version, and a `game-finished` event carrying only the version and the result (`won`, `lost` or `tie`), to the maintainers' [trace](https://github.com/Stephenson-Software/trace) service at `https://trace.danielstephenson.dev`, so that it is known whether anybody plays it. Each event also carries a random installation ID (the tag `install`), so installations can be counted rather than events. Nothing else is sent: no moves, usernames, hostnames, IP addresses, paths or anything typed at the prompt. The reports are sent from a background thread and dropped, not retried, if the service cannot be reached; at most a few seconds are waited for them when the game exits. The first run that reports prints a one-line notice and writes `~/.config/tic-tac-toe-console-game/usage-reporting.properties`.

The installation ID is a random UUID written to `~/.config/tic-tac-toe-console-game/trace-install-id`, next to the settings file, the first time reporting runs, and reused after that. It identifies no person, account or address. Delete the file to get a new one, or set `TRACE_INSTALL_ID` in the environment to pin one. Every opt-out below also stops it: when reporting is off, no ID is made up and the file is neither read nor written. The browser build does not report at all, so it has no ID.

To turn it off, any one of these is enough:

- `enabled=false` in `~/.config/tic-tac-toe-console-game/usage-reporting.properties`
- `TRACE_USAGE_REPORTING=off` (also `false`, `0`, `no`) in the environment — the switch every trace client honours, checked before the settings file
- `DO_NOT_TRACK=1` (also `true`, `yes`) in the environment, per [consoledonottrack.com](https://consoledonottrack.com)

The key in `src/UsageReporting.java` is the write key issued to this game; it can only add usage events and is not secret. The CI workflow sets `TRACE_USAGE_REPORTING=off`, so a CI run never reports.

Details on what trace collects and why: https://github.com/Stephenson-Software/trace#usage-reporting

## License
This project is released under the Stephenson Software Non-Commercial License. See
[LICENSE](LICENSE) for the full text.
