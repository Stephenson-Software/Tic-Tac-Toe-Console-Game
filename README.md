# Tic Tac Toe Console Game
This application allows the user to play Tic Tac Toe against the computer.

## Requirements
A JDK is required, not just a JRE, since the sources are compiled with `javac`. Java 7
or newer is needed, because the grid uses a `switch` on a `String`. No build system,
and no third-party dependency, is used by this project.

## Building
The three sources live flat in `src/` in the default package and are compiled with a
single command:

```
javac -d out src/*.java
```

The `out/` directory is ignored by `.gitignore`, so compiled classes are never
committed.

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
- No automated test suite exists; changes are verified by compiling and playing.

## License
This project is released under the Stephenson Software Non-Commercial License. See
[LICENSE](LICENSE) for the full text.
