// Checks web/board3d-scene.js under Node's own test runner (no dependencies):
//
//   node --test web/test/
//
// The console transcripts below are the game's real output (ThreeByThreeGrid.printGrid
// and TicTacToe's messages), so a change to how the game prints a board shows up here.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../board3d-scene.js');

const PROMPT = 'Which move would you like to make? Enter a column letter and a row number, like a1 or B2.';
function board(rows) {
  return '\n   A   B   C\n' + rows.map((r, i) => `${i + 1} [${r[0]}] [${r[1]}] [${r[2]}]`).join('\n') + '\n\n';
}

// a desktop canvas, a phone held upright and one turned sideways
const CANVASES = [[420, 420], [358, 358], [390, 844], [844, 390]];

test('before the game prints a board, the board is empty and nothing is over', () => {
  const g = S.readConsole('Loading Java...');
  assert.deepEqual(g.cells, ['', '', '', '', '', '', '', '', '']);
  assert.equal(g.result, null);
  assert.equal(g.again, false);
  assert.equal(g.seen, false);
});

test('the last board printed is the one shown, cells in reading order', () => {
  const out = board(['   ', '   ', '   ']) + PROMPT + '\n' + board(['X  ', ' O ', '   ']) + PROMPT + '\n';
  const g = S.readConsole(out);
  assert.deepEqual(g.cells, ['X', '', '', '', 'O', '', '', '', '']);
  assert.equal(g.result, null);
  assert.equal(g.seen, true);
});

test('a rejected or taken move leaves the board as the game last printed it', () => {
  const out = board([' X ', '   ', 'O  ']) + PROMPT + '\nThat space is taken! Choose another one.\n' +
    board([' X ', '   ', 'O  ']) + PROMPT + '\n';
  assert.deepEqual(S.readConsole(out).cells, ['', 'X', '', '', '', '', 'O', '', '']);
});

test('a result after the last board ends the game, and Enter starts the next', () => {
  const won = board(['XXX', 'OO ', '   ']) + 'You won!\n';
  assert.equal(S.readConsole(won).result, 'won');
  assert.equal(S.readConsole(won).again, false);
  const again = won + '\nPress Enter to play again.\n';
  assert.equal(S.readConsole(again).again, true);
  assert.equal(S.readConsole(board(['XOX', 'XOO', 'OXX']) + 'It was a tie!\n').result, 'tie');
  assert.equal(S.readConsole(board(['XX ', 'OOO', 'X  ']) + 'You lost!\n').result, 'lost');
  // the next game's empty board clears it
  const next = S.readConsole(again + board(['   ', '   ', '   ']) + PROMPT + '\n');
  assert.equal(next.result, null);
  assert.deepEqual(next.cells, ['', '', '', '', '', '', '', '', '']);
});

test('a half-printed board or a stray header is not taken for a board', () => {
  const out = board(['X  ', '   ', '   ']) + PROMPT + '\n\n   A   B   C\n1 [X] [ ] [ ]\n';
  assert.deepEqual(S.readConsole(out).cells, ['X', '', '', '', '', '', '', '', '']);
  assert.deepEqual(S.readConsole('   A   B   C\n1 [Q] [ ] [ ]\n2 [ ] [ ] [ ]\n3 [ ] [ ] [ ]\n').cells,
    ['', '', '', '', '', '', '', '', '']);
  assert.equal(S.readConsole('\r\n   A   B   C\r\n1 [ ] [ ] [ ]\r\n2 [ ] [X] [ ]\r\n3 [ ] [ ] [ ]\r\n').cells[4], 'X');
});

test('each cell types the move the game reads for it, and a typed move names its cell', () => {
  const moves = ['a1', 'b1', 'c1', 'a2', 'b2', 'c2', 'a3', 'b3', 'c3'];
  moves.forEach((m, i) => {
    assert.equal(S.moveFor(i), m);
    assert.equal(S.cellFor(m), i);
    assert.equal(S.cellFor(m.toUpperCase()), i);
  });
  for (const bad of ['', 'a', 'a4', 'd1', 'a1x', '1a', null]) assert.equal(S.cellFor(bad), null);
});

test('the winner\'s line is lit only for a finished game', () => {
  const cells = ['X', 'X', 'X', 'O', 'O', '', '', '', ''];
  assert.deepEqual(S.winningCells(cells, 'won'), [0, 1, 2]);
  assert.deepEqual(S.winningCells(cells, null), []);
  assert.deepEqual(S.winningCells(cells, 'tie'), []);
  assert.deepEqual(S.winningCells(['O', 'X', 'X', '', 'O', 'X', '', '', 'O'], 'lost'), [0, 4, 8]);
});

test('a press on any part of a tile, at any canvas shape, picks that cell', () => {
  for (const [w, h] of CANVASES) {
    const camera = S.fitCamera(w / h);
    for (let i = 0; i < 9; i++) {
      const [x, z] = S.cellCenter(i);
      for (const [dx, dz] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const p = S.projectToScreen(camera, [x + dx, S.BED_TOP, z + dz], w, h);
        assert.ok(p[0] > 0 && p[0] < w && p[1] > 0 && p[1] < h, `cell ${i} on ${w}x${h} is on the canvas`);
        assert.equal(S.pickCell(camera, p[0], p[1], w, h), i);
      }
    }
  }
});

test('a press on the frame, in a corner or on an empty canvas picks nothing', () => {
  for (const [w, h] of CANVASES) {
    const camera = S.fitCamera(w / h);
    const frame = S.projectToScreen(camera, [1.5 + S.FRAME_WIDTH / 2, S.BED_TOP, 0], w, h);
    assert.equal(S.pickCell(camera, frame[0], frame[1], w, h), null);
    assert.equal(S.pickCell(camera, 1, 1, w, h), null);
    assert.equal(S.pickCell(camera, w - 2, h - 2, w, h), null);
  }
  assert.equal(S.pickCell(S.fitCamera(1), 5, 5, 0, 0), null);
});

test('the board: nine tiles in a frame, winners yellow, a slab on the highlighted cell', () => {
  const plain = S.boardShapes([], null);
  assert.equal(plain.length, 13);
  const won = S.boardShapes([2, 4, 6], 0);
  assert.equal(won.length, 14);
  [2, 4, 6].forEach((i) => assert.deepEqual(won[i].color.slice(0, 3), S.WIN_TILE));
  assert.deepEqual(won[13].color.slice(0, 3), S.HIGHLIGHT_COLOR);
  assert.equal(won[13].position[0], S.cellCenter(0)[0]);
});

test('the wire: board, pieces, view and HUD messages read back as written', () => {
  const b = S.decode(S.encodeBoard([0, 1, 2], 4));
  assert.equal(b.kind, S.KIND_BOARD);
  assert.equal(b.shapes.length, 14);
  const cells = ['X', '', '', '', 'O', '', '', '', ''];
  const p = S.decode(S.encodePieces(cells));
  assert.equal(p.kind, S.KIND_PIECES);
  assert.equal(p.tick, 0);
  assert.equal(p.anchors.length, 2);
  assert.deepEqual(p.anchors[1], [0, 0, 0, 0]);
  assert.equal(p.shapes.length, S.markShapes('X', 0, 0).length + S.markShapes('O', 0, 0).length);
  assert.ok(p.shapes.every((s) => s.attach === 1));
  const v = S.decode(S.encodeView(S.fitCamera(1)));
  assert.equal(v.kind, S.KIND_VIEW);
  assert.ok(Math.abs(v.fovDegrees - 42) < 1e-5);
  assert.equal(S.decode(S.encodePieces(['', '', '', '', '', '', '', '', ''])).shapes.length, 0);
});

test('the HUD: the console\'s coordinates beside the board, and a result card when it is over', () => {
  for (const [w, h] of CANVASES) {
    const playing = S.decode(S.encodeHud(S.hud({result: null}, w, h)));
    assert.equal(playing.panels.length, 0);
    assert.deepEqual(playing.labels.map((l) => l.text).sort(), ['1', '2', '3', 'A', 'B', 'C']);
    for (const l of playing.labels) assert.ok(l.x >= 0 && l.y >= 0 && l.x < w && l.y < h, `${l.text} on ${w}x${h}`);
    const over = S.decode(S.encodeHud(S.hud({result: 'won', again: true}, w, h)));
    assert.equal(over.panels.length, 2);
    const texts = over.labels.map((l) => l.text);
    assert.deepEqual(texts, ['You won!', 'Tap or click to play again']);
    // the card sits above the tiles, so the last move stays in sight
    const camera = S.fitCamera(w / h);
    const backEdge = S.projectToScreen(camera, [0, S.BED_TOP, -1.5], w, h)[1];
    assert.ok(over.panels[1].y + over.panels[1].height <= backEdge + 1, `the card on ${w}x${h} ends above the tiles`);
    for (const l of over.labels) assert.ok(l.x >= 0 && l.x + l.text.length * l.pixelSize <= w, `${l.text} fits ${w}`);
  }
  const waiting = S.decode(S.encodeHud(S.hud({result: 'tie', again: false}, 400, 400)));
  assert.ok(!waiting.labels.some((l) => l.text.startsWith('Tap')));
});
