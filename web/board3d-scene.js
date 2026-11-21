/* board3d-scene.js: what the browser build's 3D board shows, as plain data.

   The Java game (TicTacToe, unchanged) keeps every rule, turn and message.
   This file only reads what the game has printed and says how that looks in
   3D, so it has no DOM and no WebGL and is checked under Node
   (web/test/board3d-scene.test.cjs):

   - readConsole(output) finds the last board the game printed

         A   B   C
       1 [X] [ ] [ ]
       2 [ ] [O] [ ]
       3 [ ] [ ] [ ]

     and whether a result line ("You won!", "You lost!", "It was a tie!")
     and "Press Enter to play again." came after it;
   - moveFor(cell) is the text the player would type for a cell ("a1" is the
     top-left space, "c3" the bottom-right), which the page types into the
     console, so every move still goes through the game's own input;
   - the board is a 3 x 3 grid of tiles in a dark frame, each X a red cross of
     blocks and each O a ring of blue beads on a low disc (the look of the
     other tic-tac-toe games' 3D boards), with the console's column letters
     and row numbers beside it;
   - pickCell(camera, x, y, w, h) casts a ray from the camera through a press
     onto the tiles: the cell under it, or null;
   - encode*() are the messages for Strata's grid relay (Strata's
     web/kit/grid-relay/WIRE.md, format 1.0).

   A classic script: in the page it defines window.TicTacToeScene; under
   Node it is the module's exports. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TicTacToeScene = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var COLUMNS = 3;
  var ROWS = 3;
  var LETTERS = "abc";

  // Strata's primitive kinds.
  var CUBE = 0;
  var CYLINDER = 2;
  var SPHERE = 3;

  // graphik grid3d's lighting and projection, as the other 3D boards.
  var CLEAR_COLOR = [0.10, 0.12, 0.16, 1.0];
  var SUN_DIRECTION = [-0.45, 0.85, 0.35];
  var NEAR_PLANE = 0.3;
  var FAR_PLANE = 200.0;
  var FOV_DEGREES = 42.0;

  var BED_TOP = 0.0;
  var TILE_HEIGHT = 0.18;
  var TILE_GAP = 0.12;
  var FRAME_WIDTH = 0.3;
  var TILE_LIGHT = [0.86, 0.85, 0.80];
  var TILE_DARK = [0.78, 0.77, 0.72];
  var WIN_TILE = [1.0, 1.0, 0.53];
  var FRAME_COLOR = [0.10, 0.10, 0.12];
  var X_COLOR = [0.86, 0.22, 0.18];
  var O_COLOR = [0.20, 0.46, 0.88];
  // green, so a hovered or typed cell never looks like a winning one
  var HIGHLIGHT_COLOR = [0.35, 0.80, 0.45];
  var DISC_SHADE = 0.45;
  var MARK_HEIGHT = 0.16;
  var MARK_BASE_HEIGHT = 0.04;
  var DISC_SIZE = 0.78;

  // The HUD (CSS pixels, Strata's 8 x 8 font: a glyph is pixelSize wide).
  var TEXT_COLOR = [0.97, 0.96, 0.92, 1.0];
  var COORD_COLOR = [0.80, 0.82, 0.86, 1.0];
  var OVERLAY_COLOR = [0.04, 0.05, 0.07, 0.55];
  var RESULT_PANEL_COLOR = [0.10, 0.12, 0.16, 0.92];

  var RESULTS = {"You won!": "won", "You lost!": "lost", "It was a tie!": "tie"};
  var AGAIN = "Press Enter to play again.";
  var HEADER = "   A   B   C";
  var ROW = /^([123]) \[(.)\] \[(.)\] \[(.)\]$/;

  // ------------------------------------------------------------ the console

  function emptyCells() {
    return ["", "", "", "", "", "", "", "", ""];
  }

  // What the game's output says now: the cells of the last board it printed
  // (index row * 3 + column, "X", "O" or ""), the result printed after that
  // board ("won", "lost", "tie" or null), and whether the game is waiting for
  // Enter to start the next one. Before any board, the board is empty.
  function readConsole(output) {
    var text = String(output || "").replace(/\r\n?/g, "\n");
    var lines = text.split("\n");
    var cells = emptyCells();
    var start = -1;
    for (var i = lines.length - 4; i >= 0; i--) {
      if (lines[i] !== HEADER) continue;
      var found = emptyCells(), ok = true;
      for (var r = 0; r < 3 && ok; r++) {
        var m = ROW.exec(lines[i + 1 + r]);
        if (!m || Number(m[1]) !== r + 1) { ok = false; break; }
        for (var c = 0; c < 3; c++) {
          var mark = m[2 + c];
          if (mark !== " " && mark !== "X" && mark !== "O") { ok = false; break; }
          found[r * 3 + c] = mark === " " ? "" : mark;
        }
      }
      if (ok) { cells = found; start = i + 4; break; }
    }
    var result = null, again = false;
    for (var k = Math.max(start, 0); k < lines.length; k++) {
      if (start >= 0 && RESULTS[lines[k]]) result = RESULTS[lines[k]];
      if (result && lines[k] === AGAIN) again = true;
    }
    return {cells: cells, result: result, again: again, seen: start >= 0};
  }

  // The move the player types for a cell: its column letter, then its row.
  function moveFor(cell) {
    return LETTERS.charAt(cell % COLUMNS) + String(Math.floor(cell / COLUMNS) + 1);
  }

  // The cell a typed move names (either case, as the game reads it), or null.
  function cellFor(move) {
    var m = /^\s*([abcABC])([123])\s*$/.exec(String(move || ""));
    return m ? (Number(m[2]) - 1) * COLUMNS + LETTERS.indexOf(m[1].toLowerCase()) : null;
  }

  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  // For a finished game only: the cells of every line the winner completed,
  // lit like the 2D boards' winning squares. The game has already said who
  // won; this only finds where.
  function winningCells(cells, result) {
    var mark = result === "won" ? "X" : result === "lost" ? "O" : null;
    var out = [];
    if (!mark) return out;
    LINES.forEach(function (line) {
      if (line.every(function (i) { return cells[i] === mark; })) {
        line.forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); });
      }
    });
    return out.sort();
  }

  // ------------------------------------------------------------ the scene

  function shape(kind, position, scale, rgb, shadeBy) {
    var s = shadeBy === undefined ? 1 : shadeBy;
    var color = rgb.map(function (c) { return Math.max(0, Math.min(1, c * s)); });
    return {kind: kind, position: position, scale: scale, color: color.concat([1])};
  }

  // World (x, z) of the middle of a cell (0 is a1, the top left, nearest the
  // back of the board as the console prints it first).
  function cellCenter(i) {
    return [(i % COLUMNS) - (COLUMNS - 1) / 2, Math.floor(i / COLUMNS) - (ROWS - 1) / 2];
  }

  // South of the board, looking down about 55 degrees, far enough back that
  // the board, its frame and the letters fit; a tall canvas backs it off.
  function fitCamera(aspect) {
    var size = Math.max(COLUMNS, ROWS) + 1.3;
    size *= Math.max(1, 1 / Math.max(aspect, 0.5));
    var distance = 0.86 * size + 0.9;
    return {eye: [0, 1.35 * distance, 0.95 * distance], target: [0, -0.3, -0.04 * size], fovDegrees: FOV_DEGREES};
  }

  // The tiles (checkered, the winning ones yellow), the frame, and a thin
  // slab on the highlighted cell (or none).
  function boardShapes(winning, highlight) {
    var shapes = [];
    var edge = 1 - TILE_GAP;
    for (var i = 0; i < 9; i++) {
      var p = cellCenter(i);
      var color = winning && winning.indexOf(i) >= 0 ? WIN_TILE :
        ((i % 3) + Math.floor(i / 3)) % 2 ? TILE_DARK : TILE_LIGHT;
      shapes.push(shape(CUBE, [p[0], BED_TOP - TILE_HEIGHT / 2, p[1]], [edge, TILE_HEIGHT, edge], color));
    }
    var half = 1.5;
    var height = TILE_HEIGHT + 0.12;
    var yMid = BED_TOP - TILE_HEIGHT + height / 2;
    var wide = 3 + 2 * FRAME_WIDTH;
    shapes.push(shape(CUBE, [0, yMid, -half - FRAME_WIDTH / 2], [wide, height, FRAME_WIDTH], FRAME_COLOR));
    shapes.push(shape(CUBE, [0, yMid, half + FRAME_WIDTH / 2], [wide, height, FRAME_WIDTH], FRAME_COLOR));
    shapes.push(shape(CUBE, [-half - FRAME_WIDTH / 2, yMid, 0], [FRAME_WIDTH, height, 3], FRAME_COLOR));
    shapes.push(shape(CUBE, [half + FRAME_WIDTH / 2, yMid, 0], [FRAME_WIDTH, height, 3], FRAME_COLOR));
    if (highlight !== null && highlight !== undefined && highlight >= 0 && highlight < 9) {
      var h = cellCenter(highlight);
      shapes.push(shape(CUBE, [h[0], BED_TOP + 0.005, h[1]], [edge, 0.01, edge], HIGHLIGHT_COLOR));
    }
    return shapes;
  }

  // One mark standing at world (x, z): a low disc and an X of blocks along
  // both diagonals (Strata's primitives are axis-aligned) or an O of beads.
  function markShapes(mark, x, z) {
    if (mark !== "X" && mark !== "O") return [];
    var color = mark === "X" ? X_COLOR : O_COLOR;
    var out = [shape(CYLINDER, [x, BED_TOP + MARK_BASE_HEIGHT / 2, z], [DISC_SIZE, MARK_BASE_HEIGHT, DISC_SIZE], color,
      DISC_SHADE)];
    var y = BED_TOP + MARK_BASE_HEIGHT + MARK_HEIGHT / 2;
    var i;
    if (mark === "X") {
      var steps = 9, reach = 0.27, block = 0.13;
      for (i = 0; i < steps; i++) {
        var t = -reach + (2 * reach * i) / (steps - 1);
        out.push(shape(CUBE, [x + t, y, z + t], [block, MARK_HEIGHT, block], color));
        if (i !== Math.floor(steps / 2)) out.push(shape(CUBE, [x + t, y, z - t], [block, MARK_HEIGHT, block], color));
      }
    } else {
      var beads = 16, radius = 0.26, bead = 0.15;
      for (i = 0; i < beads; i++) {
        var a = (2 * Math.PI * i) / beads;
        out.push(shape(SPHERE, [x + radius * Math.cos(a), y, z + radius * Math.sin(a)], [bead, MARK_HEIGHT, bead],
          color));
      }
    }
    return out;
  }

  // ------------------------------------------------------------ picking
  // The same right-handed look-at and OpenGL perspective Strata draws with.

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var n = Math.sqrt(dot(a, a)); return [a[0] / n, a[1] / n, a[2] / n]; }

  function basis(camera) {
    var forward = unit(sub(camera.target, camera.eye));
    var right = unit(cross(forward, [0, 1, 0]));
    return [forward, right, cross(right, forward)];
  }

  // Where world point p lands on a width x height canvas (pixels from the top
  // left), or null behind the camera.
  function projectToScreen(camera, p, width, height) {
    var b = basis(camera);
    var offset = sub(p, camera.eye);
    var depth = dot(offset, b[0]);
    if (depth <= 0) return null;
    var focal = 1 / Math.tan((camera.fovDegrees * Math.PI) / 360);
    var aspect = width / height;
    return [((focal / aspect) * dot(offset, b[1]) / depth + 1) / 2 * width,
      (1 - (focal * dot(offset, b[2])) / depth) / 2 * height];
  }

  // The cell (0-8) under canvas pixel (x, y), or null: the whole cell counts,
  // the gap between tiles included; the frame and beyond pick nothing.
  function pickCell(camera, x, y, width, height) {
    if (!(width > 0 && height > 0)) return null;
    var b = basis(camera);
    var focal = 1 / Math.tan((camera.fovDegrees * Math.PI) / 360);
    var aspect = width / height;
    var nx = (x / width) * 2 - 1;
    var ny = 1 - (y / height) * 2;
    var d = [0, 1, 2].map(function (i) { return b[0][i] + (b[1][i] * nx * aspect) / focal + (b[2][i] * ny) / focal; });
    if (d[1] >= 0) return null;
    var t = (BED_TOP - camera.eye[1]) / d[1];
    if (t <= 0) return null;
    var column = Math.floor(camera.eye[0] + d[0] * t + COLUMNS / 2);
    var row = Math.floor(camera.eye[2] + d[2] * t + ROWS / 2);
    if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return null;
    return row * COLUMNS + column;
  }

  // ------------------------------------------------------------ the HUD

  function textWidth(text, size) { return text.length * size; }

  function label(x, y, size, color, text) {
    return {x: Math.round(x), y: Math.round(y), pixelSize: size, color: color, text: text};
  }

  // While a game is on, the console's coordinates beside the board (A B C
  // behind it, 1 2 3 on its left, where the console prints them); for a
  // finished game, the board dimmed with the result and how to start the next
  // game on a card above it, clear of the tiles.
  function hud(state, width, height) {
    var out = {panels: [], labels: []};
    if (!(width > 0 && height > 0)) return out;
    var camera = fitCamera(width / height);
    var size = Math.max(10, Math.min(22, Math.round(Math.min(width, height) * 0.045)));
    var i, p;
    if (state && state.result) return resultHud(state, width, height, out);
    for (i = 0; i < 3; i++) {
      p = projectToScreen(camera, [i - 1, BED_TOP, -1.5 - FRAME_WIDTH - 0.35], width, height);
      if (p) out.labels.push(label(p[0] - size / 2, p[1] - size / 2, size, COORD_COLOR, "ABC".charAt(i)));
      p = projectToScreen(camera, [-1.5 - FRAME_WIDTH - 0.35, BED_TOP, i - 1], width, height);
      if (p) out.labels.push(label(p[0] - size / 2, p[1] - size / 2, size, COORD_COLOR, String(i + 1)));
    }
    return out;
  }

  function resultHud(state, width, height, out) {
    var text = {won: "You won!", lost: "You lost!", tie: "It was a tie!"}[state.result];
    var shortest = Math.min(width, height);
    var big = Math.floor(Math.min(0.085 * shortest, 0.8 * width / text.length));
    big = Math.max(8, Math.min(big, 96));
    var small = Math.max(8, Math.min(Math.round(big * 0.42), Math.floor(0.8 * width / 24)));
    var hint = state.again ? "Tap or click to play again" : "";
    var cardW = Math.max(textWidth(text, big), textWidth(hint, small));
    var pad = Math.round(big * 0.6);
    var cardH = big + (hint ? Math.round(small * 1.8) : 0);
    var top = Math.round(Math.max(pad, 0.12 * height - big / 2));
    out.panels.push({x: 0, y: 0, width: width, height: height, color: OVERLAY_COLOR});
    out.panels.push({x: Math.round((width - cardW) / 2 - pad), y: top - pad, width: cardW + 2 * pad,
      height: cardH + 2 * pad, color: RESULT_PANEL_COLOR});
    out.labels.push(label((width - textWidth(text, big)) / 2, top, big, TEXT_COLOR, text));
    if (hint) {
      out.labels.push(label((width - textWidth(hint, small)) / 2, top + big + Math.round(small * 0.8), small,
        COORD_COLOR, hint));
    }
    return out;
  }

  // ------------------------------------------------------------ the wire
  // Every message: an 8-byte header ("G3", 1, 0, kind, 0, 0), then a
  // little-endian body.

  var KIND_BOARD = 1;
  var KIND_PIECES = 2;
  var KIND_HUD = 3;
  var KIND_VIEW = 4;
  var WORLD = 0;
  var PIECE = 1;

  function Writer(bytes) {
    this.view = new DataView(new ArrayBuffer(bytes));
    this.at = 0;
  }
  Writer.prototype.u8 = function (v) { this.view.setUint8(this.at, v); this.at += 1; };
  Writer.prototype.u16 = function (v) { this.view.setUint16(this.at, v, true); this.at += 2; };
  Writer.prototype.u32 = function (v) { this.view.setUint32(this.at, v, true); this.at += 4; };
  Writer.prototype.f32 = function (v) { this.view.setFloat32(this.at, v, true); this.at += 4; };
  Writer.prototype.floats = function (vs) { for (var i = 0; i < vs.length; i++) this.f32(vs[i]); };
  Writer.prototype.header = function (kind) {
    this.u8(0x47); this.u8(0x33); this.u8(1); this.u8(0); this.u8(kind); this.u8(0); this.u16(0);
  };
  Writer.prototype.shape = function (s, attach, anchor, dx, dz) {
    this.u8(s.kind); this.u8(attach); this.u16(anchor); this.u16(0); this.u16(0);
    this.floats([s.position[0] - (dx || 0), s.position[1], s.position[2] - (dz || 0)]);
    this.floats(s.scale);
    this.floats(s.color);
  };
  Writer.prototype.bytes = function () { return new Uint8Array(this.view.buffer); };

  // BOARD: the tiles, the frame and the highlight slab, as world shapes.
  function encodeBoard(winning, highlight) {
    var shapes = boardShapes(winning, highlight);
    var w = new Writer(16 + shapes.length * 48);
    w.header(KIND_BOARD);
    w.u32(shapes.length);
    w.u32(0);
    shapes.forEach(function (s) { w.shape(s, WORLD, 0); });
    return w.bytes();
  }

  // PIECES: one anchor per mark, standing on its cell (a tick of 0: no
  // slide), and the mark's shapes measured from it.
  function encodePieces(cells) {
    var anchors = [], shapes = [];
    cells.forEach(function (mark, i) {
      if (!mark) return;
      var p = cellCenter(i);
      var a = anchors.length;
      anchors.push(p);
      markShapes(mark, p[0], p[1]).forEach(function (s) { shapes.push([a, s]); });
    });
    var w = new Writer(24 + anchors.length * 16 + shapes.length * 48);
    w.header(KIND_PIECES);
    w.f32(0);
    w.u32(anchors.length);
    w.u32(shapes.length);
    w.u32(0);
    anchors.forEach(function (p) { w.floats([p[0], p[1], p[0], p[1]]); });
    shapes.forEach(function (e) { w.shape(e[1], PIECE, e[0], anchors[e[0]][0], anchors[e[0]][1]); });
    return w.bytes();
  }

  // VIEW: the camera, clear colour and direction to the sun.
  function encodeView(camera) {
    var w = new Writer(8 + 64);
    w.header(KIND_VIEW);
    w.floats(camera.eye);
    w.floats(camera.target);
    w.floats([camera.fovDegrees, NEAR_PLANE, FAR_PLANE]);
    w.floats(CLEAR_COLOR);
    w.floats(SUN_DIRECTION);
    return w.bytes();
  }

  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
    return Uint8Array.from(unescape(encodeURIComponent(text)), function (c) { return c.charCodeAt(0); });
  }

  // HUD: panels, then labels (32 bytes each plus the text, padded to 4).
  function encodeHud(h) {
    var texts = h.labels.map(function (l) { return utf8(l.text); });
    var size = 16 + h.panels.length * 32;
    texts.forEach(function (t) { size += 32 + Math.ceil(t.length / 4) * 4; });
    var w = new Writer(size);
    w.header(KIND_HUD);
    w.u32(h.panels.length);
    w.u32(h.labels.length);
    h.panels.forEach(function (p) { w.floats([p.x, p.y, p.width, p.height]); w.floats(p.color); });
    h.labels.forEach(function (l, i) {
      w.floats([l.x, l.y, l.pixelSize]);
      w.floats(l.color);
      w.u16(texts[i].length);
      w.u16(0);
      for (var k = 0; k < texts[i].length; k++) w.u8(texts[i][k]);
      while (w.at % 4) w.u8(0);
    });
    return w.bytes();
  }

  // What a message says, read back (for tests).
  function decode(bytes) {
    var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint8(0) !== 0x47 || v.getUint8(1) !== 0x33 || v.getUint8(2) !== 1) throw new Error("not a wire 1.x message");
    var kind = v.getUint8(4);
    function f(at) { return v.getFloat32(at, true); }
    function readShape(at) {
      return {kind: v.getUint8(at), attach: v.getUint8(at + 1), anchor: v.getUint16(at + 2, true),
        position: [f(at + 8), f(at + 12), f(at + 16)], scale: [f(at + 20), f(at + 24), f(at + 28)],
        color: [f(at + 32), f(at + 36), f(at + 40), f(at + 44)]};
    }
    var i, out;
    if (kind === KIND_BOARD) {
      out = {kind: kind, shapes: [], lights: v.getUint32(12, true)};
      for (i = 0; i < v.getUint32(8, true); i++) out.shapes.push(readShape(16 + 48 * i));
      return out;
    }
    if (kind === KIND_PIECES) {
      var anchors = v.getUint32(12, true), n = v.getUint32(16, true), start = 24 + anchors * 16;
      out = {kind: kind, tick: f(8), anchors: [], shapes: []};
      for (i = 0; i < anchors; i++) out.anchors.push([f(24 + 16 * i), f(28 + 16 * i), f(32 + 16 * i), f(36 + 16 * i)]);
      for (i = 0; i < n; i++) out.shapes.push(readShape(start + 48 * i));
      return out;
    }
    if (kind === KIND_VIEW) {
      return {kind: kind, eye: [f(8), f(12), f(16)], target: [f(20), f(24), f(28)], fovDegrees: f(32)};
    }
    out = {kind: kind, panels: [], labels: []};
    var np = v.getUint32(8, true), nl = v.getUint32(12, true), at = 16;
    for (i = 0; i < np; i++, at += 32) out.panels.push({x: f(at), y: f(at + 4), width: f(at + 8), height: f(at + 12)});
    for (i = 0; i < nl; i++) {
      var len = v.getUint16(at + 28, true);
      var text = "";
      for (var k = 0; k < len; k++) text += String.fromCharCode(v.getUint8(at + 32 + k));
      out.labels.push({x: f(at), y: f(at + 4), pixelSize: f(at + 8), text: text});
      at += 32 + Math.ceil(len / 4) * 4;
    }
    if (at !== bytes.byteLength) throw new Error("HUD length " + bytes.byteLength + ", read " + at);
    return out;
  }

  return {
    COLUMNS: COLUMNS, ROWS: ROWS, CUBE: CUBE, CYLINDER: CYLINDER, SPHERE: SPHERE, BED_TOP: BED_TOP,
    FRAME_WIDTH: FRAME_WIDTH, WIN_TILE: WIN_TILE, HIGHLIGHT_COLOR: HIGHLIGHT_COLOR, X_COLOR: X_COLOR, O_COLOR: O_COLOR,
    KIND_BOARD: KIND_BOARD, KIND_PIECES: KIND_PIECES, KIND_HUD: KIND_HUD, KIND_VIEW: KIND_VIEW,
    readConsole: readConsole, moveFor: moveFor, cellFor: cellFor, winningCells: winningCells,
    cellCenter: cellCenter, fitCamera: fitCamera, boardShapes: boardShapes, markShapes: markShapes,
    projectToScreen: projectToScreen, pickCell: pickCell, hud: hud,
    encodeBoard: encodeBoard, encodePieces: encodePieces, encodeView: encodeView, encodeHud: encodeHud, decode: decode,
  };
});
