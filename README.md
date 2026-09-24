# Tic Tac Toe Console Game
This application allows the user to play Tic Tac Toe against the computer.

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
on every push to `master` and every pull request, followed by one bounded game played
from piped input as a smoke test.

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
them — `a1` is the top-left space, `b2` the center, `c3` the bottom-right. Only
lowercase column letters are recognized (see Known limitations below).

If an occupied space is chosen, `That space is taken! Choose another one.` is printed
and the board is shown again.

The game ends as soon as a line of three is completed or the board fills, and one of
`You won!`, `You lost!`, or `It was a tie!` is printed with the final board.

## Known limitations
- Only lowercase column letters are translated; an uppercase or otherwise unrecognized
  letter is silently played in column A
  ([#3](https://github.com/Stephenson-Software/Tic-Tac-Toe-Console-Game/issues/3)).
- Move input is not validated, so a one-character entry, a non-digit row, or a row
  outside 1-3 ends the game with an unhandled exception
  ([#4](https://github.com/Stephenson-Software/Tic-Tac-Toe-Console-Game/issues/4)).
- No quit command is offered; a game in progress is left only by interrupting the
  process. Reaching end of input — `Ctrl+D`, or a piped script running out of moves —
  ends it with a `NoSuchElementException` rather than cleanly.
- No automated test suite exists; changes are verified by compiling and playing. The
  CI workflow only checks that the sources compile and that a game runs to a result
  line, not which moves the computer makes or who wins.

## Usage reporting
Usage reporting is on by default: each run sends a `startup` event carrying the game's name and version, and a `game-finished` event carrying only the result (`won`, `lost` or `tie`), to the maintainers' [trace](https://github.com/Stephenson-Software/trace) service at `https://trace.danielstephenson.dev`, so that it is known whether anybody plays it. Nothing else is sent: no moves, usernames, hostnames, IP addresses, paths or anything typed at the prompt. The reports are sent from a background thread and dropped, not retried, if the service cannot be reached; at most a few seconds are waited for them when the game exits. The first run that reports prints a one-line notice and writes `~/.config/tic-tac-toe-console-game/usage-reporting.properties`.

To turn it off, any one of these is enough:

- `enabled=false` in `~/.config/tic-tac-toe-console-game/usage-reporting.properties`
- `TRACE_USAGE_REPORTING=off` (also `false`, `0`, `no`) in the environment — the switch every trace client honours, checked before the settings file
- `DO_NOT_TRACK=1` (also `true`, `yes`) in the environment, per [consoledonottrack.com](https://consoledonottrack.com)

The key in `src/UsageReporting.java` is the write key issued to this game; it can only add usage events and is not secret. The CI workflow sets `TRACE_USAGE_REPORTING=off`, so a CI run never reports.

Details on what trace collects and why: https://github.com/Stephenson-Software/trace#usage-reporting

## License
This project is released under the Stephenson Software Non-Commercial License. See
[LICENSE](LICENSE) for the full text.
