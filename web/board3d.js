/* board3d.js: the browser build's 3D board, beside the console (window.TicTacToe3D).

   The console stays the game: the Java program (TicTacToe, unchanged) prints
   every board and message to the page's terminal and reads every move from
   its text field. The 3D board only mirrors what the game has printed
   (board3d-scene.js reads it) and, on a click or tap on a cell, types that
   cell's move ("a1" .. "c3") into the console, through the same path as the
   text field's Enter button. So a move made on the board is checked, played
   or refused by the game exactly as if it had been typed. After a result, a
   click or tap anywhere on the board presses Enter for the next game.

   The board is drawn by Strata's grid relay (strata/, from Strata's release,
   fetched by web/fetch-strata.sh). 3D is the default where it can run: the
   relay checks its size and WebGL 2 before downloading its module, and when
   it can't run the page stays text-only with the reason in a note. The
   "3D board" button switches it off and on (remembered on this device), and
   ?view=2d or ?view=3d in the address picks for one visit; ?view=2d never
   downloads it.

   The page calls:
     TicTacToe3D.init({type(line), canType()})   once, when the page is ready
     TicTacToe3D.output(text)                    whenever the game prints
     TicTacToe3D.typed(text)                     the text field's contents, to
                                                 highlight the cell it names */
(function () {
  "use strict";
  var Scene = window.TicTacToeScene;
  var STORE = "tic-tac-toe-console-game:view";
  var EVENT_MOUSE_MOTION = 4;
  var EVENT_MOUSE_BUTTON_DOWN = 5;
  var EVENT_RESIZED = 8;

  var want = true;
  var hooks = {type: function () { return false; }, canType: function () { return false; }};
  var game = Scene.readConsole("");
  var hover = null, typedCell = null;
  var size = {width: 360, height: 360};
  var sent = {};
  var frame = null, holding = false;
  var els = {};

  // StrataLoader's and the relay's failure codes, in words.
  var REASONS = {
    "no-webgl2": "this browser has no WebGL 2",
    "network": "the 3D board could not be downloaded",
    "load": "the 3D board could not be downloaded",
    "engine": "the 3D engine could not start",
    "context-lost": "the graphics context was lost",
  };
  function reasonOf(s) {
    var code = s.slice("failed:".length);
    return REASONS[code] || code;
  }

  function relay() { return window.StrataGridRelay || null; }
  function state() { return relay() ? relay().state() : "failed:the 3D board did not load"; }
  function showing() { return want && state() === "ready"; }

  function stored() {
    try { return window.localStorage.getItem(STORE); } catch (e) { return null; }
  }
  function store(view) {
    try { window.localStorage.setItem(STORE, view); } catch (e) { /* a private window: not remembered */ }
  }

  // Keys never reach the relay: the board has none of its own (the text field
  // is the keyboard's way to play), and the relay would otherwise keep Space,
  // Tab and Backspace from working in the text field. Stopped while capturing
  // at the window, before the relay's listener; typing still happens.
  function holdKey(e) { e.stopPropagation(); }
  function holdKeys(on) {
    if (on && !holding) {
      window.addEventListener("keydown", holdKey, true);
      window.addEventListener("keyup", holdKey, true);
    } else if (!on && holding) {
      window.removeEventListener("keydown", holdKey, true);
      window.removeEventListener("keyup", holdKey, true);
    }
    holding = on;
  }

  function render() {
    var s = state(), failed = s.indexOf("failed:") === 0, on = showing();
    var loading = want && s === "loading";
    if (els.box) els.box.hidden = !(on || loading);
    if (els.page) els.page.classList.toggle("with-board", on || loading);
    if (els.button) {
      els.button.setAttribute("aria-pressed", want && !failed ? "true" : "false");
      els.button.disabled = failed;
      els.button.textContent = failed ? "3D board unavailable" : "3D board";
      els.button.title = failed ? reasonOf(s) : (want ? "Hide the 3D board (play in text only)" : "Show the 3D board");
    }
    if (els.note) {
      els.note.textContent = failed && want ? "Text only: the 3D board can't run here (" + reasonOf(s) + ")." :
        loading ? "Loading the 3D board…" : "";
    }
  }

  function equal(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // The messages whose contents changed since they were last sent.
  function send() {
    var camera = Scene.fitCamera(size.width / size.height);
    var highlight = game.result ? null : (typedCell !== null ? typedCell : hover);
    var messages = {
      board: Scene.encodeBoard(Scene.winningCells(game.cells, game.result), highlight),
      view: Scene.encodeView(camera),
      pieces: Scene.encodePieces(game.cells),
      hud: Scene.encodeHud(Scene.hud(game, size.width, size.height)),
    };
    ["board", "view", "pieces", "hud"].forEach(function (name) {
      if (!equal(sent[name], messages[name]) && relay().sendBytes(messages[name]) >= 0) sent[name] = messages[name];
    });
  }

  // A press on the board: after a result, Enter for the next game; otherwise
  // the move for the cell under it, typed into the console.
  function press(x, y) {
    if (!hooks.canType()) return;
    if (game.result) {
      if (game.again) hooks.type("");
      return;
    }
    var cell = Scene.pickCell(Scene.fitCamera(size.width / size.height), x, y, size.width, size.height);
    if (cell !== null) hooks.type(Scene.moveFor(cell));
  }

  function input(events) {
    events.forEach(function (e) {
      if (e.type === EVENT_RESIZED && e.width > 0 && e.height > 0) {
        size = {width: e.width, height: e.height};
      } else if (e.type === EVENT_MOUSE_MOTION && e.pointer === "mouse") {
        hover = Scene.pickCell(Scene.fitCamera(size.width / size.height), e.x, e.y, size.width, size.height);
      } else if (e.type === EVENT_MOUSE_BUTTON_DOWN && e.button === 1) {
        press(e.x, e.y);
      }
    });
  }

  // Every frame while the relay loads or shows: its state, the player's
  // input and whatever the board needs to send.
  function tick() {
    frame = null;
    var s = state();
    if (s === "ready" && !want) {
      relay().close();
      holdKeys(false);
      render();
      return;
    }
    if (s === "ready") {
      holdKeys(true);
      try { input(JSON.parse(relay().poll())); } catch (e) { /* nothing new */ }
      send();
    }
    render();
    if (s === "loading" || s === "ready") frame = window.requestAnimationFrame(tick);
  }

  function watch() {
    if (frame === null) frame = window.requestAnimationFrame(tick);
  }

  function start() {
    if (!relay()) { render(); return; }
    sent = {};
    relay().request(JSON.stringify({canvas: "relay", base: "strata/", title: "the 3D board", maxBytes: 4000000}));
    watch();
  }

  function setWant(on) {
    want = on;
    hover = null;
    store(on ? "3d" : "2d");
    if (on) {
      start();
    } else {
      holdKeys(false);
      if (state() === "ready") relay().close();
      render();
    }
  }

  window.TicTacToe3D = {
    init: function (h) {
      hooks = h;
      els.box = document.getElementById("board3d");
      els.page = document.getElementById("play");
      els.button = document.getElementById("view3d");
      els.note = document.getElementById("view3d-note");
      var canvas = document.getElementById("relay");
      if (canvas) canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      var asked = /[?&]view=(2d|3d)\b/.exec(window.location.search);
      want = (asked ? asked[1] : stored()) !== "2d";
      if (els.button) els.button.addEventListener("click", function () { setWant(!want); });
      if (want) start();
      render();
    },
    output: function (text) { game = Scene.readConsole(text); },
    typed: function (text) { typedCell = Scene.cellFor(text); },
    state: state,
    showing: function () { return showing(); },
    game: function () { return game; },
  };
})();
